import {
  DashboardActionSchema,
  RequestStateResultSchema,
  ExtractionResultSchema,
  FriendlyMessageSchema,
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
  buildFriendlyMessagePrompt,
  buildFriendlyMessageInput,
} from "@conversational/llm";
import {
  PolicyEngine,
  type NormalizedIntent,
  type PolicyConfig,
} from "@conversational/policy";
import type { ActionProvider } from "@conversational/providers";
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

export interface StageRationale {
  stage1?: {
    rationale?: string;
    classification?: string;
    confidence?: number;
  };
  stage2?: {
    rationale?: string;
    informationType?: string;
    filters?: Record<string, unknown>;
    confidence?: number;
  };
}

export interface ResolveRequest {
  message: string;
  /** Turnos anteriores da conversa, repassados ao LLM como contexto de histórico. */
  history?: ConversationTurn[];
  /** Callback opcional para observar a intent normalizada retornada pelo LLM/policy. */
  onIntentResolved?: (intent: NormalizedIntent) => void;
  /** Callback opcional para observar o rationale das etapas 1 e 2 do pipeline. */
  onStageRationale?: (rationale: StageRationale) => void;
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

  let stage1Result: StageRationale["stage1"];
  let stage2Result: StageRationale["stage2"];

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
    request.onStageRationale?.({});
    return resolveInitialOrientationAction(provider);
  }

  stage1Result = {
    rationale: requestState.rationale,
    classification: requestState.requestState,
    confidence: requestState.confidence,
  };

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
    request.onStageRationale?.({ stage1: stage1Result });

    const orientationAction = await resolveInitialOrientationAction(provider);
    return enrichWithFriendlyMessage(
      llm,
      orientationAction,
      request.message,
      { proposedFilters: {}, confidence: requestState.confidence, rationale: requestState.rationale },
      request.history,
    );
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
    request.onStageRationale?.({ stage1: stage1Result });
    return resolveInitialOrientationAction(provider);
  }

  // ── Normalizar extração via PolicyEngine ──────────────────────
  const normalizedExtraction = policyEngine.normalizeExtraction(extraction);

  const intent = buildIntent(requestState, normalizedExtraction);

  logStep(2, "Extração Estruturada", {
    informationType: extraction.candidateInformationType ?? "—",
    filters: extraction.proposedFilters,
    confidence: extraction.confidence,
  });

  stage2Result = {
    rationale: extraction.rationale,
    informationType: normalizedExtraction.candidateInformationType ?? undefined,
    filters: { ...normalizedExtraction.proposedFilters },
    confidence: extraction.confidence,
  };

  request.onIntentResolved?.(intent);
  request.onStageRationale?.({ stage1: stage1Result, stage2: stage2Result });

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
  );

  // ── Etapa 4 — Geração de mensagem amigável (LLM, best-effort) ─
  logStepStart(4, "Geração de mensagem amigável");

  const enrichedAction = await enrichWithFriendlyMessage(
    llm,
    action,
    request.message,
    normalizedExtraction,
    request.history,
  );

  logStep(4, "Geração de mensagem amigável", {
    actionType: enrichedAction.type,
    hasMessage: "message" in enrichedAction && !!enrichedAction.message,
  });

  logOutput(enrichedAction.type);

  return enrichedAction;
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
    municipio: filters.municipio ?? undefined,
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
): Promise<DashboardAction> {
  switch (decision.responseType) {
    case "give_initial_orientation":
      return resolveInitialOrientationAction(provider);

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
        action = await provider.generate(intentForProvider);
      } catch {
        logFallback("execute_show_provider_falha", "fallback_initial_orientation");
        return resolveInitialOrientationAction(provider);
      }

      const validated = DashboardActionSchema.safeParse(action);
      if (!validated.success) {
        logFallback("execute_show_invalid_action", "fallback_initial_orientation");
        return resolveInitialOrientationAction(provider);
      }

      return validated.data;
    }

    default:
      return resolveInitialOrientationAction(provider);
  }
}

/**
 * Enriquece a ação com uma mensagem amigável gerada pelo LLM (Etapa 4).
 * Opera em modo best-effort: se a geração falhar, retorna a ação original inalterada.
 */
async function enrichWithFriendlyMessage(
  llm: LlmPort,
  action: DashboardAction,
  userMessage: string,
  extraction: ExtractionResult,
  history?: ConversationTurn[],
): Promise<DashboardAction> {
  try {
    const informationType =
      action.type === "open_url"
        ? (action.meta?.["informationType"] as string | undefined)
        : undefined;

    const originalMessage =
      "message" in action ? (action as { message?: string }).message : undefined;

    const contextInput = buildFriendlyMessageInput({
      userMessage,
      actionType: action.type,
      informationType,
      filters: extraction.proposedFilters as Record<string, unknown>,
      suggestions: "suggestions" in action ? (action as { suggestions?: string[] }).suggestions : undefined,
      missing: "missing" in action ? (action as { missing?: string[] }).missing : undefined,
      originalMessage,
    });

    const prompt = buildFriendlyMessagePrompt();
    const result = await llm.generateStructured(
      FriendlyMessageSchema,
      contextInput,
      prompt,
      history,
    );

    return { ...action, message: result.message };
  } catch {
    logFallback("etapa4_falha", "mensagem_original_mantida");
    return action;
  }
}

