import type { DashboardAction } from "@conversational/domain";
import type { ActionProvider, ResolveContext } from "../action-provider.js";

/**
 * CustomProvider returns a run_query action
 * that delegates to a custom "tourism.resolve" function.
 */
export class CustomProvider implements ActionProvider {
  readonly id = "custom";

  supports(_ctx: ResolveContext): boolean {
    return true;
  }

  async generate(
    intent: {
      intent: string;
      proposedFilters: Record<string, unknown>;
      entities: Record<string, unknown>;
      confidence: number;
      rationale?: string;
    },
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
