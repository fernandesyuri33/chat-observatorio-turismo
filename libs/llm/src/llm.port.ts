import type { z } from "zod";

/**
 * Um turno de conversa para contextualização do LLM.
 * `role` indica quem falou; `content` é o texto do turno.
 */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Interface de porta para qualquer adaptador de LLM.
 * `generateStructured` envia uma string de entrada e espera
 * que o modelo retorne saída conforme o schema Zod informado.
 * O parâmetro opcional `history` injeta turnos anteriores no contexto da chamada.
 */
export interface LlmPort {
  generateStructured<T>(
    schema: z.ZodType<T>,
    input: string,
    history?: ConversationTurn[]
  ): Promise<T>;
}
