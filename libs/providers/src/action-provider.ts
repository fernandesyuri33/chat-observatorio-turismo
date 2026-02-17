import type { DashboardAction } from "@conversational/domain";

export interface ResolveContext {
  dashboardId?: string;
  currentFilters?: Record<string, unknown>;
}

/**
 * Strategy interface for action providers.
 * Each provider has a unique id, declares what it supports,
 * and can generate a DashboardAction from a normalized intent.
 */
export interface ActionProvider {
  readonly id: string;
  supports(ctx: ResolveContext): boolean;
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
