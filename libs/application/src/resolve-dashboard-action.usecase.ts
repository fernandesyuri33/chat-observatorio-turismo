import {
  INFORMATION_TYPE_VALUES,
  DashboardActionSchema,
  type DashboardAction,
  type InformationType,
} from "@conversational/domain";
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

const INFORMATION_TYPE_LABEL: Record<InformationType, string> = {
  estabelecimentos_por_municipio: "Quantidade de estabelecimentos por município",
  funcionarios_por_municipio: "Quantidade de funcionários por município",
  funcionarios_ao_longo_do_tempo: "Quantidade de funcionários ao longo do tempo",
  saldo_funcionarios_ao_longo_do_tempo: "Saldo de funcionários ao longo do tempo",
};

const INFORMATION_TYPES = new Set<InformationType>(INFORMATION_TYPE_VALUES);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasInformationTypeMention(message: string, synonyms: Record<string, string>): boolean {
  const normalizedMessage = normalizeText(message);
  const terms = new Set<string>([
    "estabelecimentos por municipio",
    "funcionarios por municipio",
    "funcionarios ao longo do tempo",
    "saldo de funcionarios ao longo do tempo",
    "saldo funcionarios ao longo do tempo",
  ]);

  for (const [synonym, canonical] of Object.entries(synonyms)) {
    if (INFORMATION_TYPES.has(canonical as InformationType)) {
      terms.add(normalizeText(synonym));
    }
  }

  for (const term of terms) {
    if (normalizedMessage.includes(term)) {
      return true;
    }
  }

  return false;
}

function hasOnlyFilterContext(intent: NormalizedIntent): boolean {
  if (intent.intent !== "show") {
    return false;
  }

  return Object.keys(intent.proposedFilters).length > 0;
}

function buildContextualOrientationMessage(intent: NormalizedIntent): string {
  const base = "A partir desse recorte, você pode explorar:";

  if (intent.proposedFilters.municipio) {
    return `${base} em ${intent.proposedFilters.municipio}. Qual abordagem você prefere? Também posso listar tudo o que é possível observar deste recorte.`;
  }

  if (intent.proposedFilters.classificacao) {
    return `${base} para a classificação ${intent.proposedFilters.classificacao}. Qual abordagem você prefere? Também posso listar tudo o que é possível observar deste recorte.`;
  }

  return `${base} Qual abordagem você prefere? Também posso listar tudo o que é possível observar deste recorte.`;
}

function buildContextualOrientationSuggestions(optionCount: number): string[] {
  return INFORMATION_TYPE_VALUES
    .slice(0, optionCount)
    .map((informationType) => INFORMATION_TYPE_LABEL[informationType]);
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

  if (
    hasOnlyFilterContext(normalized) &&
    !hasInformationTypeMention(request.message, config.synonyms)
  ) {
    return explainOnlyFallback(
      buildContextualOrientationMessage(normalized),
      buildContextualOrientationSuggestions(config.fallback.contextualOrientationOptionCount)
    );
  }

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
