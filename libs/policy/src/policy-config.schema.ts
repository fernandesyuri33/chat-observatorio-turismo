import { z } from "zod";

// ── Policy configuration Zod schema ─────────────────────────────

export const PolicyConfigSchema = z.object({
  mode: z.enum(["free", "guided", "strict"]),
  minConfidence: z.number().min(0).max(1),
  allowAmbiguity: z.boolean(),
  knownMetrics: z.array(z.string()),
  knownDimensions: z.array(z.string()),
  synonyms: z.record(z.string()),
  activeProvider: z.string().describe("Id of the single active ActionProvider (e.g. 'looker', 'custom')"),
  fallback: z.object({
    onSchemaInvalid: z.enum(["retry_llm", "explain_only"]),
    onLowConfidence: z.enum(["explain_only", "heuristic", "ask_clarifying"]),
    retryCount: z.number().int().min(0),
  }),
  looker: z.object({
    baseUrl: z.string().url(),
    paramMap: z.record(z.string()),
    informationTypeMap: z.record(z.string()),
  }),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;
