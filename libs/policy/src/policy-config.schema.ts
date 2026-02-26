import { z } from "zod";

const POLICY_INFORMATION_TYPE_VALUES = [
  "funcionarios_ao_longo_do_tempo",
  "saldo_funcionarios_ao_longo_do_tempo",
  "funcionarios_por_municipio",
  "estabelecimentos_por_municipio",
] as const;

const CuriosityFaqEntrySchema = z.object({
  questionExamples: z.array(z.string().min(1)).min(1),
  response: z.string().min(1),
  suggestion: z.string().min(1),
  informationType: z.enum(POLICY_INFORMATION_TYPE_VALUES),
});

// ── Schema Zod de configuração de política ──────────────────────

export const PolicyConfigSchema = z.object({
  minConfidence: z.number().min(0).max(1),
  synonyms: z.record(z.string()),
  activeProvider: z.string().describe("Id do único ActionProvider ativo (ex.: 'looker', 'custom')"),
  fallback: z.object({
    retryCount: z.number().int().min(0),
    contextualOrientationOptionCount: z.number().int().min(1),
  }),
  curiosityFaq: z.array(CuriosityFaqEntrySchema).optional(),
  looker: z.object({
    baseUrl: z.string().url(),
    paramMap: z.record(z.string()),
    informationTypeMap: z.record(z.string()),
  }),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;
