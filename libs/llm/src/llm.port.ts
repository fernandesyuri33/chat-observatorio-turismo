import type { z } from "zod";

/**
 * Port interface for any LLM adapter.
 * `generateStructured` sends an input string and expects
 * the model to return output conforming to the given Zod schema.
 */
export interface LlmPort {
  generateStructured<T>(schema: z.ZodType<T>, input: string): Promise<T>;
}
