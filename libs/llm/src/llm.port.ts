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
 *
 * @param schema      Schema Zod que define a estrutura esperada da resposta.
 * @param input       Mensagem do usuário.
 * @param systemPrompt Prompt de sistema que contextualiza a chamada ao modelo.
 * @param history     Turnos anteriores da conversa injetados no contexto.
 */
export interface LlmPort {
  generateStructured<T>(
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    input: string,
    systemPrompt: string,
    history?: ConversationTurn[],
  ): Promise<T>;
}
