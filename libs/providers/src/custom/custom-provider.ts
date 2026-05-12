import type { DashboardAction, IntentV1 } from "@conversational/domain";
import type { ActionProvider } from "../action-provider.js";

/**
 * CustomProvider retorna uma ação run_query
 * que delega para a função customizada "tourism.resolve".
 */
export class CustomProvider implements ActionProvider {
  readonly id = "custom";

  async generate(intent: IntentV1): Promise<DashboardAction> {
    if (intent.intent === "initial_orientation" || intent.intent === "curiosity_to_action") {
      return {
        type: "explain_only",
        message:
          intent.intent === "curiosity_to_action"
            ? "Posso te ajudar a transformar essa curiosidade em um recorte objetivo no dashboard."
            : "Posso sugerir alguns caminhos de exploração:",
        suggestions:
          intent.intent === "curiosity_to_action"
            ? ["Acompanhar a evolução de funcionários ao longo do tempo"]
            : [
                "Comparar estabelecimentos entre municípios",
                "Visualizar a quantidade de funcionários por município",
                "Acompanhar a evolução de funcionários ao longo do tempo",
              ],
        meta: { provider: "custom", intent: intent.intent },
      };
    }

    return {
      type: "run_query",
      function: "tourism.resolve",
      args: { intent },
      meta: { provider: "custom" },
    };
  }
}
