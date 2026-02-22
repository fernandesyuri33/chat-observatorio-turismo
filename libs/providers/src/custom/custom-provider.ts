import type { DashboardAction, IntentV1 } from "@conversational/domain";
import type { ActionProvider, ResolveContext } from "../action-provider.js";

/**
 * CustomProvider returns a run_query action
 * that delegates to a custom "tourism.resolve" function.
 */
export class CustomProvider implements ActionProvider {
  readonly id = "custom";

  async generate(
    intent: IntentV1,
    _ctx: ResolveContext
  ): Promise<DashboardAction> {
    if (intent.intent === "initial_orientation") {
      return {
        type: "explain_only",
        message: "Posso sugerir alguns caminhos de exploração:",
        suggestions: [
          "Comparar estabelecimentos entre municípios",
          "Visualizar a quantidade de funcionários por município",
          "Acompanhar a evolução de funcionários ao longo do tempo",
        ],
        meta: { provider: "custom", intent: "initial_orientation" },
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
