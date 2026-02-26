import type { z } from "zod";

/**
 * Interface de porta para qualquer adaptador de LLM.
 * `generateStructured` envia uma string de entrada e espera
 * que o modelo retorne saída conforme o schema Zod informado.
 */
export interface LlmPort {
  generateStructured<T>(schema: z.ZodType<T>, input: string): Promise<T>;
}
