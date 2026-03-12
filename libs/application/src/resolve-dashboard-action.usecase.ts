import {
  INFORMATION_TYPE_VALUES,
  DashboardActionSchema,
  type IntentV1,
  type DashboardAction,
  type InformationType,
} from "@conversational/domain";
import type { LlmPort, ConversationTurn } from "@conversational/llm";
import {
  PolicyEngine,
  type NormalizedIntent,
  type PolicyConfig,
} from "@conversational/policy";
import type { ActionProvider, ResolveContext } from "@conversational/providers";
import { getSchemaEntry, getActiveVersion } from "./schema-registry.js";
import { explainOnlyFallback } from "./fallback.js";

type CuriosityFaqEntry = NonNullable<PolicyConfig["curiosityFaq"]>[number];

export interface ResolveDashboardActionDeps {
  llm: LlmPort;
  policyEngine: PolicyEngine;
  provider: ActionProvider;
}

export interface ResolveRequest {
  message: string;
  ctx?: ResolveContext;
  /** Turnos anteriores da conversa, repassados ao LLM como contexto de histórico. */
  history?: ConversationTurn[];
  /** Callback opcional para observar a intent normalizada retornada pelo LLM/policy. */
  onIntentResolved?: (intent: NormalizedIntent) => void;
}

const INFORMATION_TYPE_LABEL: Record<InformationType, string> = {
  estabelecimentos_por_municipio: "Quantidade de estabelecimentos por município",
  funcionarios_por_municipio: "Quantidade de funcionários por município",
  funcionarios_ao_longo_do_tempo: "Quantidade de funcionários ao longo do tempo",
  saldo_funcionarios_ao_longo_do_tempo: "Saldo de funcionários ao longo do tempo",
};

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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeText(value: string): Set<string> {
  const normalized = normalizeText(value).replace(/[^a-z0-9\s]/g, " ");
  return new Set(normalized.split(/\s+/).filter((token) => token.length >= 3));
}

function scoreFaqMatch(message: string, example: string): number {
  const messageTokens = tokenizeText(message);
  const exampleTokens = tokenizeText(example);

  if (messageTokens.size === 0 || exampleTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of messageTokens) {
    if (exampleTokens.has(token)) {
      intersection += 1;
    }
  }

  if (intersection < 2) {
    return 0;
  }

  return intersection / exampleTokens.size;
}

function findCuriosityFaqMatch(
  message: string,
  entries?: PolicyConfig["curiosityFaq"]
): CuriosityFaqEntry | undefined {
  if (!entries || entries.length === 0) {
    return undefined;
  }

  let bestScore = 0;
  let bestEntry: CuriosityFaqEntry | undefined;

  for (const entry of entries) {
    for (const example of entry.questionExamples) {
      const score = scoreFaqMatch(message, example);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
  }

  if (bestScore < 0.45) {
    return undefined;
  }

  return bestEntry;
}

function buildCuriosityToAction(entry: CuriosityFaqEntry): DashboardAction {
  return {
    type: "explain_only",
    message: entry.response,
    suggestions: [entry.suggestion],
    meta: {
      curiosityToAction: true,
      informationType: entry.informationType,
    },
  };
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
    // Continua para a ação padrão de orientação
  }

  return buildDefaultInitialOrientationAction();
}

/**
 * Caso de uso central: resolve uma mensagem do usuário em um DashboardAction validado.
 *
 * Fluxo:
 * 1. Chama o LLM via registro de schemas para obter uma intenção estruturada
 * 2. Normaliza a intenção via PolicyEngine
 * 3. Verifica limite de confiança (baixa confiança volta para orientação inicial)
 * 4. Encaminha para o provider correto
 * 5. Valida a saída com DashboardActionSchema
 * 6. Em qualquer falha, volta para orientação inicial
 */
export async function resolveDashboardAction(
  deps: ResolveDashboardActionDeps,
  request: ResolveRequest
): Promise<DashboardAction> {
  const { llm, policyEngine, provider } = deps;
  const config = policyEngine.getConfig();
  const ctx: ResolveContext = request.ctx ?? {};

  // ── Etapa 1: Obter intenção estruturada do LLM ────────────────
  const version = getActiveVersion();
  const schemaEntry = getSchemaEntry(version);

  let rawIntent: unknown;
  try {
    rawIntent = await llm.generateStructured(
      schemaEntry.schema,
      request.message,
      request.history
    );
  } catch {
    return resolveInitialOrientationAction(provider, ctx);
  }

  // ── Etapa 2: Normalizar intenção ──────────────────────────────
  const parsed = rawIntent as NormalizedIntent;
  const normalized = policyEngine.normalizeIntent(parsed, request.message);
  request.onIntentResolved?.(normalized);

  if (normalized.intent === "contextual_orientation") {
    return explainOnlyFallback(
      buildContextualOrientationMessage(normalized),
      buildContextualOrientationSuggestions(config.fallback.contextualOrientationOptionCount)
    );
  }

  if (normalized.intent === "curiosity_to_action") {
    const curiosityMatch = findCuriosityFaqMatch(request.message, config.curiosityFaq);
    if (!curiosityMatch) {
      return resolveInitialOrientationAction(provider, ctx);
    }

    return buildCuriosityToAction(curiosityMatch);
  }

  // ── Etapa 3: Verificar confiança ──────────────────────────────
  if (normalized.confidence < config.minConfidence) {
    return resolveInitialOrientationAction(provider, ctx);
  }

  // ── Etapa 4: Gerar ação a partir do provider ──────────────────
  let action: DashboardAction;
  try {
    action = await provider.generate(normalized, ctx);
  } catch {
    return resolveInitialOrientationAction(provider, ctx);
  }

  // ── Etapa 5: Validar saída com DashboardActionSchema ──────────
  const validated = DashboardActionSchema.safeParse(action);
  if (!validated.success) {
    return resolveInitialOrientationAction(provider, ctx);
  }

  return validated.data;
}
