import type { DashboardAction } from "@conversational/domain";
import type { PolicyConfig } from "@conversational/policy";
import type { ActionProvider, ResolveContext } from "../action-provider.js";

/**
 * LookerProvider builds open_url actions using the Looker
 * base URL and paramMap from the policy config.
 */
export class LookerProvider implements ActionProvider {
  readonly id = "looker";

  constructor(private readonly lookerConfig: PolicyConfig["looker"]) {}

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
    const url = new URL(this.lookerConfig.baseUrl);
    const intentLabel: Record<string, string> = {
      filter: "filtro",
      compare: "comparação",
      trend: "tendência",
      topN: "top N",
      help: "ajuda",
    };

    // Map proposedFilters through paramMap to URL query params
    for (const [filterKey, filterValue] of Object.entries(intent.proposedFilters)) {
      const paramName = this.lookerConfig.paramMap[filterKey] ?? filterKey;
      if (filterValue !== undefined && filterValue !== null) {
        url.searchParams.set(paramName, String(filterValue));
      }
    }

    return {
      type: "open_url",
      url: url.toString(),
      title: `Looker: ${intentLabel[intent.intent] ?? intent.intent}`,
      meta: { provider: "looker", intent: intent.intent },
    };
  }
}
