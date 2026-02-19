import type { DashboardAction } from "@conversational/domain";

export interface ResolveContext {
  dashboardId?: string;
  currentFilters?: Record<string, unknown>;
}

/**
 * Strategy interface for action providers.
 * Each provider has a unique id and can generate a DashboardAction
 * from any normalized intent. Only one provider is active at a time
 * (configured via `activeProvider` in policy.json). Every provider
 * implementation must handle all intent types.
 */
export interface ActionProvider {
  readonly id: string;
  generate(
    intent: {
      intent: string;
      proposedFilters: Record<string, unknown>;
      entities: Record<string, unknown>;
      confidence: number;
      rationale?: string;
    },
    ctx: ResolveContext
  ): Promise<DashboardAction>;
}
