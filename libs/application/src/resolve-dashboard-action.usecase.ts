import {
  INFORMATION_TYPE_VALUES,
  DashboardActionSchema,
  type IntentV1,
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

function buildDefaultInitialOrientationAction(): DashboardAction {
  return explainOnlyFallback(
    "Posso sugerir alguns caminhos de exploração:",
    [
      "Comparar estabelecimentos entre municípios",
      "Visualizar a quantidade de funcionários por município",
      "Acompanhar a evolução de funcionários ao longo do tempo",
    ]
  );
}

async function resolveInitialOrientationAction(
  provider: ActionProvider,
  ctx: ResolveContext
): Promise<DashboardAction> {
  const initialOrientationIntent: IntentV1 = {
    intent: "initial_orientation",
    proposedFilters: {},
    confidence: 1,
  };

  try {
    const action = await provider.generate(initialOrientationIntent, ctx);
    const validated = DashboardActionSchema.safeParse(action);
    if (validated.success) {
      return validated.data;
    }
  } catch {
    // falls through to default orientation action
  }

  return buildDefaultInitialOrientationAction();
}

/**
 * Core use case: resolve a user message into a validated DashboardAction.
 *
 * Flow:
 * 1. Call LLM via schema registry to get a structured intent
 * 2. Normalize intent via PolicyEngine
 * 3. Check confidence threshold (low confidence defaults to initial orientation)
 * 4. Route to the correct provider
 * 5. Validate output with DashboardActionSchema
 * 6. On any failure, default to initial orientation
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
  const maxRetries = config.fallback.retryCount;

  while (true) {
    try {
      rawIntent = await llm.generateStructured(schemaEntry.schema, request.message);
      break;
    } catch (err) {
      retries++;
      if (retries > maxRetries) {
        return resolveInitialOrientationAction(provider, ctx);
      }
      // retry loop continues
    }
  }

  // ── Step 2: Normalize intent ──────────────────────────────────
  const parsed = rawIntent as NormalizedIntent;
  const normalized = policyEngine.normalizeIntent(parsed);

  if (normalized.intent === "contextual_orientation") {
    return explainOnlyFallback(
      buildContextualOrientationMessage(normalized),
      buildContextualOrientationSuggestions(config.fallback.contextualOrientationOptionCount)
    );
  }

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
    return resolveInitialOrientationAction(provider, ctx);
  }

  // ── Step 4: Generate action from provider ──────────────────────
  let action: DashboardAction;
  try {
    action = await provider.generate(normalized, ctx);
  } catch {
    return resolveInitialOrientationAction(provider, ctx);
  }

  // ── Step 5: Validate output against DashboardActionSchema ─────
  const validated = DashboardActionSchema.safeParse(action);
  if (!validated.success) {
    return resolveInitialOrientationAction(provider, ctx);
  }

  return validated.data;
}
