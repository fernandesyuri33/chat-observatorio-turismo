import type { DashboardAction } from "@conversational/domain";

/**
 * Creates a safe "explain_only" fallback action from an error or message.
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
