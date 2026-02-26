import type { DashboardAction } from "@conversational/domain";

/**
 * Cria uma ação de fallback "explain_only" segura a partir de um erro ou mensagem.
 */
export function explainOnlyFallback(
  reason: string,
  suggestions: string[] = [
    "Tente reformular sua pergunta",
    "Peça ajuda",
  ]
): DashboardAction {
  return {
    type: "explain_only",
    message: reason,
    suggestions,
    meta: { fallback: true },
  };
}
