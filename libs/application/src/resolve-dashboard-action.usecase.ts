import {
  DashboardActionSchema,
  RequestStateResultSchema,
  ExtractionResultSchema,
  type IntentV1,
  type DashboardAction,
  type RequestStateResult,
  type ExtractionResult,
  type ResponseDecision,
} from "@conversational/domain";
import type { LlmPort, ConversationTurn } from "@conversational/llm";
import {
  buildRequestStatePrompt,
  buildExtractionPrompt,
} from "@conversational/llm";
import {
  PolicyEngine,
  type NormalizedIntent,
  type PolicyConfig,
} from "@conversational/policy";
import type { ActionProvider, ResolveContext } from "@conversational/providers";
import { explainOnlyFallback } from "./fallback.js";
import { routeResponse } from "./response-router.js";
import { logStep, logStepStart, logOutput, logFallback, logInfo } from "./pipeline-logger.js";
import {
  buildContextualOrientationMessage,
  buildContextualOrientationSuggestions,
  buildCuriosityToAction,
  buildAskMissingInformationAction,
  resolveInitialOrientationAction,
} from "./response-builder.js";

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

/**
 * Caso de uso central: resolve uma mensagem em linguagem natural do usuário
 * em um {@link DashboardAction} validado via Zod.
 *
 * O pipeline opera em **3 etapas sequenciais**, cada uma com responsabilidade isolada:
 *
 * ### Etapa 1 — Request State Detection (LLM)
 * Classifica a mensagem do usuário em um dos estados de pedido
 * (`complete_show`, `context_only`, `initial_orientation`, `curiosity_to_action`, `unclear`).
 * Pedidos de orientação inicial ou mensagens vagas (`unclear`) fazem short-circuit
 * direto para a ação de orientação, sem avançar para as demais etapas.
 *
 * ### Etapa 2 — Structured Extraction (LLM)
 * Extrai campos estruturados da mensagem: `candidateInformationType` e `proposedFilters`.
 * O resultado é normalizado pelo {@link PolicyEngine} (sinônimos, sanitização de filtros)
 * antes de prosseguir.
 *
 * ### Etapa 3 — Response Decision (determinístico, sem LLM)
 * O {@link routeResponse} cruza o estado do pedido com os dados extraídos e a configuração
 * de policy para produzir uma {@link ResponseDecision} determinística. A decisão é então
 * traduzida em um `DashboardAction` concreto via {@link executeDecision}.
 *
 * ### Garantias
 * - **Fallback seguro:** toda exceção ou falha de validação retorna `initial_orientation`
 *   (nunca propaga erro para a camada HTTP).
 * - **Saída validada:** o `DashboardAction` final é sempre validado com
 *   `DashboardActionSchema.safeParse` antes de ser retornado.
 * - **Callback de observabilidade:** se `onIntentResolved` for fornecido, o pipeline
 *   notifica a intent normalizada reconstruída, permitindo persistência de histórico
 *   e logging sem acoplamento.
 */
export async function resolveDashboardAction(
  deps: ResolveDashboardActionDeps,
  request: ResolveRequest
): Promise<DashboardAction> {
  const { llm, policyEngine, provider } = deps;
  const config = policyEngine.getConfig();
  const ctx: ResolveContext = request.ctx ?? {};

  logStepStart(1, "Detecção do estado da requisição");

  const requestStatePrompt = buildRequestStatePrompt();
  let requestState: RequestStateResult;
  try {
    requestState = await llm.generateStructured(
      RequestStateResultSchema,
      request.message,
      requestStatePrompt,
      request.history,
    );
  } catch {
    logFallback("etapa1_falha", "fallback_initial_orientation");
    return resolveInitialOrientationAction(provider, ctx);
  }

  logStep(1, "Detecção do estado da requisição", {
    state: requestState.requestState,
    confidence: requestState.confidence,
  });

  // ── Short-circuit: initial_orientation / unclear → sem extração
  if (
    requestState.requestState === "initial_orientation" ||
    requestState.requestState === "unclear"
  ) {
    logInfo("etapa1_short_circuit", {
      state: requestState.requestState,
      decision: "give_initial_orientation",
    });

    const intent: NormalizedIntent = {
      intent: "initial_orientation",
      proposedFilters: {},
      confidence: requestState.confidence,
      rationale: requestState.rationale,
    };
    request.onIntentResolved?.(intent);

    return resolveInitialOrientationAction(provider, ctx);
  }

  logStepStart(2, "Extração Estruturada");

  let extraction: ExtractionResult;
  try {
    extraction = await llm.generateStructured(
      ExtractionResultSchema,
      request.message,
      buildExtractionPrompt(),
      request.history,
    );
  } catch {
    logFallback("etapa2_falha", "fallback_initial_orientation");
    return resolveInitialOrientationAction(provider, ctx);
  }

  // ── Normalizar extração via PolicyEngine ──────────────────────
  const normalizedExtraction = policyEngine.normalizeExtraction(extraction);

  const intent = buildIntent(requestState, normalizedExtraction);

  logStep(2, "Extração Estruturada", {
    informationType: extraction.candidateInformationType ?? "—",
    filters: extraction.proposedFilters,
    confidence: extraction.confidence,
  });

  request.onIntentResolved?.(intent);

  logStepStart(3, "Decisão de Resposta");

  const decision = routeResponse({
    requestState,
    extraction: normalizedExtraction,
    config,
    message: request.message,
  });

  logStep(3, "Decisão de Resposta", {
    responseType: decision.responseType,
    intent: intent.intent,
    informationType: (intent as { informationType?: string }).informationType ?? "—",
    filters: intent.proposedFilters,
  });

  // ── Executar decisão ──────────────────────────────────────────
  const action = await executeDecision(
    decision,
    normalizedExtraction,
    config,
    provider,
    ctx
  );

  logOutput(action.type);

  return action;
}

// ── Helpers internos ────────────────────────────────────────────

type StrictIntentFilters = {
  classificacao?: ExtractionResult["proposedFilters"]["classificacao"] extends infer C
    ? Exclude<C, null>
    : never;
  municipio?: string;
};

/**
 * Converte proposedFilters do ExtractionResult (que pode conter null via Zod)
 * para o formato IntentFilters usado pelo NormalizedIntent (sem null).
 */
function stripNullFilters(
  filters: ExtractionResult["proposedFilters"]
): StrictIntentFilters {
  return {
    classificacao: filters.classificacao ?? undefined,
    municipio: filters.municipio,
  };
}

/**
 * Reconstrói um NormalizedIntent a partir do request state e da extração.
 * Alimenta o callback {@link ResolveRequest.onIntentResolved} e a
 * interface {@link ActionProvider.generate}.
 */
function buildIntent(
  requestState: RequestStateResult,
  extraction: ExtractionResult
): NormalizedIntent {
  const state = requestState.requestState;
  const filters = stripNullFilters(extraction.proposedFilters);

  if (state === "complete_show" && extraction.candidateInformationType) {
    return {
      intent: "show",
      informationType: extraction.candidateInformationType,
      proposedFilters: filters,
      confidence: extraction.confidence,
      rationale: extraction.rationale,
    };
  }

  if (state === "context_only") {
    return {
      intent: "contextual_orientation",
      proposedFilters: filters,
      confidence: extraction.confidence,
      rationale: extraction.rationale,
    };
  }

  if (state === "curiosity_to_action") {
    return {
      intent: "curiosity_to_action",
      proposedFilters: filters,
      confidence: extraction.confidence,
      rationale: extraction.rationale,
    };
  }

  // Fallback: show genérico ou initial_orientation
  return {
    intent: "initial_orientation",
    proposedFilters: filters,
    confidence: extraction.confidence,
    rationale: extraction.rationale,
  };
}

/**
 * Executa a decisão de resposta, traduzindo ResponseDecision para DashboardAction.
 * Mantém fallbacks seguros em todos os pontos de falha.
 */
async function executeDecision(
  decision: ResponseDecision,
  extraction: ExtractionResult,
  config: PolicyConfig,
  provider: ActionProvider,
  ctx: ResolveContext
): Promise<DashboardAction> {
  switch (decision.responseType) {
    case "give_initial_orientation":
      return resolveInitialOrientationAction(provider, ctx);

    case "give_contextual_orientation":
      return explainOnlyFallback(
        buildContextualOrientationMessage(decision.filters),
        buildContextualOrientationSuggestions(
          config.fallback.contextualOrientationOptionCount
        )
      );

    case "convert_curiosity_to_action":
      return buildCuriosityToAction({
        response: decision.faqResponse,
        suggestion: decision.faqSuggestion,
        informationType: decision.faqInformationType,
      });

    case "ask_missing_information":
      return buildAskMissingInformationAction(
        decision.missing,
        decision.context,
        config.fallback.contextualOrientationOptionCount
      );

    case "execute_show": {
      const intentForProvider: IntentV1 = {
        intent: "show",
        informationType: decision.informationType,
        proposedFilters: decision.filters,
        confidence: extraction.confidence,
        rationale: extraction.rationale,
      };

      let action: DashboardAction;
      try {
        action = await provider.generate(intentForProvider, ctx);
      } catch {
        logFallback("execute_show_provider_falha", "fallback_initial_orientation");
        return resolveInitialOrientationAction(provider, ctx);
      }

      const validated = DashboardActionSchema.safeParse(action);
      if (!validated.success) {
        logFallback("execute_show_invalid_action", "fallback_initial_orientation");
        return resolveInitialOrientationAction(provider, ctx);
      }

      return validated.data;
    }

    default:
      return resolveInitialOrientationAction(provider, ctx);
  }
}

