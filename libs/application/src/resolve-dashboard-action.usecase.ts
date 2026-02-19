import { DashboardActionSchema, type DashboardAction } from "@conversational/domain";
import type { LlmPort } from "@conversational/llm";
import { PolicyEngine, type NormalizedIntent } from "@conversational/policy";
import type { ActionProvider, ResolveContext } from "@conversational/providers";
import { getSchemaEntry, getActiveVersion } from "./schema-registry.js";
import { explainOnlyFallback } from "./fallback.js";

export interface ResolveDashboardActionDeps {
  llm: LlmPort;
  policyEngine: PolicyEngine;
  provider: ActionProvider;
}

export interface ResolveRequest {
  message: string;
  ctx?: ResolveContext;
}

/**
 * Core use case: resolve a user message into a validated DashboardAction.
 *
 * Flow:
 * 1. Call LLM via schema registry to get a structured intent
 * 2. Normalize intent via PolicyEngine
 * 3. Check confidence thresholds
 * 4. Route to the correct provider
 * 5. Validate output with DashboardActionSchema
 * 6. Handle fallback at every failure point
 */
export async function resolveDashboardAction(
  deps: ResolveDashboardActionDeps,
  request: ResolveRequest
): Promise<DashboardAction> {
  const { llm, policyEngine, provider } = deps;
  const config = policyEngine.getConfig();
  const ctx: ResolveContext = request.ctx ?? {};

  // ── Step 1: Get structured intent from LLM ────────────────────
  const version = getActiveVersion();
  const schemaEntry = getSchemaEntry(version);

  let rawIntent: unknown;
  let retries = 0;
  const maxRetries = config.fallback.onSchemaInvalid === "retry_llm"
    ? config.fallback.retryCount
    : 0;

  while (true) {
    try {
      rawIntent = await llm.generateStructured(schemaEntry.schema, request.message);
      break;
    } catch (err) {
      retries++;
      if (retries > maxRetries) {
        if (config.fallback.onSchemaInvalid === "explain_only" || retries > maxRetries) {
          return explainOnlyFallback(
            "Não consegui interpretar sua solicitação. O modelo de linguagem retornou uma resposta inválida.",
            ["Tente reformular sua pergunta", "Peça ajuda"]
          );
        }
      }
      // retry loop continues
    }
  }

  // ── Step 2: Normalize intent ──────────────────────────────────
  const parsed = rawIntent as NormalizedIntent;
  const normalized = policyEngine.normalizeIntent(parsed);

  // ── Step 3: Check confidence ──────────────────────────────────
  if (normalized.confidence < config.minConfidence) {
    if (config.fallback.onLowConfidence === "explain_only") {
      return explainOnlyFallback(
        `Baixa confiança (${normalized.confidence.toFixed(2)}). Seja mais específico, por favor.`,
        ["Inclua mais detalhes na pergunta", "Quais métricas você quer analisar?"]
      );
    }
    if (config.fallback.onLowConfidence === "ask_clarifying") {
      return explainOnlyFallback(
        "Não tenho certeza se entendi. Pode esclarecer?",
        ["Qual indicador você procura?", "Qual período de tempo?"]
      );
    }
    // "heuristic" → proceed anyway
  }

  // ── Step 4: Generate action from provider ──────────────────────
  let action: DashboardAction;
  try {
    action = await provider.generate(normalized, ctx);
  } catch (err) {
    return explainOnlyFallback(
      "Ocorreu um erro ao gerar a ação do dashboard.",
      ["Tente novamente", "Peça ajuda"]
    );
  }

  // ── Step 5: Validate output against DashboardActionSchema ─────
  const validated = DashboardActionSchema.safeParse(action);
  if (!validated.success) {
    return explainOnlyFallback(
      "A ação gerada não passou na validação.",
      ["Tente reformular sua pergunta"]
    );
  }

  return validated.data;
}
