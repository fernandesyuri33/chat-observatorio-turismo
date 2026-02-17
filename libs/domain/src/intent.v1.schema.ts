import { z } from "zod";

// ── Intent v1 — LLM structured output schema ───────────────────

export const IntentV1Schema = z.object({
  intent: z.enum(["filter", "compare", "trend", "topN", "help"]),
  proposedFilters: z.record(z.any()),
  entities: z.record(z.any()),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export type IntentV1 = z.infer<typeof IntentV1Schema>;
