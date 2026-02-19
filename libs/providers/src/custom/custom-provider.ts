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
    return {
      type: "run_query",
      function: "tourism.resolve",
      args: { intent },
      meta: { provider: "custom" },
    };
  }
}
