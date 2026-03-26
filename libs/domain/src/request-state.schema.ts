import { z } from "zod";

// ── Request State — classificação do estado do pedido do usuário ─

export const REQUEST_STATE_VALUES = [
  "complete_show",
  "context_only",
  "initial_orientation",
  "curiosity_to_action",
  "unclear",
] as const;

export const RequestStateSchema = z.enum(REQUEST_STATE_VALUES);

/**
 * Schema de saída do LLM para a Etapa 1 (Request State Detection).
 * Classifica o estado do pedido do usuário sem extrair dados estruturados.
 */
export const RequestStateResultSchema = z.object({
  requestState: RequestStateSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export type RequestState = z.infer<typeof RequestStateSchema>;
export type RequestStateResult = z.infer<typeof RequestStateResultSchema>;
