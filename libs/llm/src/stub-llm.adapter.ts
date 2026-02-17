import type { z } from "zod";
import type { LlmPort } from "./llm.port.js";

/**
 * Stub LLM adapter for development/testing.
 * Returns deterministic structured output based on keyword matching.
 */
export class StubLlmAdapter implements LlmPort {
  async generateStructured<T>(schema: z.ZodType<T>, input: string): Promise<T> {
    const lower = input.toLowerCase();

    let raw: unknown;

    if (lower.includes("invalid")) {
      // Return an intentionally invalid shape to test fallback
      raw = { bad: "data" };
    } else if (lower.includes("occupancy") || lower.includes("ocupação")) {
      raw = {
        intent: "trend",
        proposedFilters: { indicador: "ocupacao" },
        entities: { metric: "occupancy" },
        confidence: 0.8,
        rationale: "Usuário pediu tendência de ocupação",
      };
    } else if (lower.includes("help")) {
      raw = {
        intent: "help",
        proposedFilters: {},
        entities: {},
        confidence: 0.9,
        rationale: "Usuário pediu ajuda",
      };
    } else {
      raw = {
        intent: "filter",
        proposedFilters: {},
        entities: {},
        confidence: 0.6,
        rationale: "Intenção genérica de filtro",
      };
    }

    // Parse through the provided schema — may throw if raw is invalid
    return schema.parse(raw);
  }
}
