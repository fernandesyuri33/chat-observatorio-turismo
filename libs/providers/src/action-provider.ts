import type { DashboardAction, IntentV1 } from "@conversational/domain";

export interface ResolveContext {
  dashboardId?: string;
  currentFilters?: Record<string, unknown>;
}

/**
 * Interface de estratégia para providers de ação.
 * Cada provider possui um id único e pode gerar um DashboardAction
 * a partir de qualquer intent normalizado. Apenas um provider fica ativo por vez
 * (configurado via `activeProvider` em policy.json). Toda implementação de provider
 * deve tratar todos os tipos de intent.
 */
export interface ActionProvider {
  readonly id: string;
  generate(
    intent: IntentV1,
    ctx: ResolveContext
  ): Promise<DashboardAction>;
}
