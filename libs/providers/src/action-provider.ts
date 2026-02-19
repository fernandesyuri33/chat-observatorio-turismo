import type { DashboardAction, IntentV1 } from "@conversational/domain";

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
    intent: IntentV1,
    ctx: ResolveContext
  ): Promise<DashboardAction>;
}
