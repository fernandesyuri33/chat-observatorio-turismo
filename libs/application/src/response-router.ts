import type {
  RequestStateResult,
  ExtractionResult,
  ResponseDecision,
} from "@conversational/domain";
import type { PolicyConfig } from "@conversational/policy";
import { findCuriosityFaqMatch } from "./curiosity-matcher.js";

// ── Response Router — decisão determinística (Etapa 3) ──────────
// Função pura que recebe os resultados das etapas anteriores e
// devolve uma decisão estruturada de resposta sem consultar LLM.

export interface RouteResponseParams {
  /** Resultado da Etapa 1 (request state detection via LLM) */
  requestState: RequestStateResult;
  /** Resultado da Etapa 2 (extração semântica via LLM), null se stage 2 foi skippada */
  extraction: ExtractionResult | null;
  /** Configuração de política */
  config: PolicyConfig;
  /** Mensagem original do usuário */
  message: string;
}

/**
 * Decide a próxima resposta do sistema com base nos resultados das etapas anteriores.
 * Lógica puramente determinística — não acessa LLM, rede ou estado externo.
 */
export function routeResponse(params: RouteResponseParams): ResponseDecision {
  const { requestState, extraction, config, message } = params;
  const { requestState: state } = requestState;

  // ── Initial orientation ou unclear → orientação inicial
  if (state === "initial_orientation" || state === "unclear") {
    return { responseType: "give_initial_orientation" };
  }

  // ── Curiosity to action → buscar no FAQ
  if (state === "curiosity_to_action") {
    const faqMatch = findCuriosityFaqMatch(message, config.curiosityFaq);
    if (faqMatch) {
      return {
        responseType: "convert_curiosity_to_action",
        faqResponse: faqMatch.response,
        faqSuggestion: faqMatch.suggestion,
        faqInformationType: faqMatch.informationType,
      };
    }
    // Sem match de FAQ → orientação inicial
    return { responseType: "give_initial_orientation" };
  }

  // ── Context only → orientação contextual ou ask missing
  if (state === "context_only") {
    const filters = extraction?.proposedFilters ?? {};
    return {
      responseType: "give_contextual_orientation",
      filters,
    };
  }

  // ── Complete show → verificar se temos todos os dados para executar
  if (state === "complete_show" && extraction) {
    // Verificar confiança mínima
    if (extraction.confidence < config.minConfidence) {
      return { responseType: "give_initial_orientation" };
    }

    // Se a extração obteve informationType, executar show
    if (extraction.candidateInformationType) {
      return {
        responseType: "execute_show",
        informationType: extraction.candidateInformationType,
        filters: extraction.proposedFilters,
      };
    }

    // Complete show sem informationType → pedir informação faltante
    const filters = extraction.proposedFilters;
    const hasFilters = Object.keys(filters).some(
      (key) => filters[key as keyof typeof filters] !== undefined
    );

    if (hasFilters) {
      return {
        responseType: "ask_missing_information",
        missing: ["informationType"],
        context: filters,
      };
    }

    // Sem filtros nem informationType → orientação inicial
    return { responseType: "give_initial_orientation" };
  }

  // ── Fallback seguro
  return { responseType: "give_initial_orientation" };
}
