import { z } from "zod";

// ── Schema para a saída do LLM na Etapa 4 (mensagem amigável) ──

export const FriendlyMessageSchema = z.object({
  message: z.string(),
});

export type FriendlyMessage = z.infer<typeof FriendlyMessageSchema>;
