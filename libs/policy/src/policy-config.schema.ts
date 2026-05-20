import { z } from "zod";

const POLICY_INFORMATION_TYPE_VALUES = [
  "funcionarios_ao_longo_do_tempo",
  "saldo_funcionarios_ao_longo_do_tempo",
  "funcionarios_por_municipio",
  "estabelecimentos_por_municipio",
] as const;

const LOOKER_FILTER_KEY_VALUES = ["municipio", "classificacao"] as const;

const CuriosityFaqEntrySchema = z.object({
  questionExamples: z.array(z.string().min(1)).min(1),
  response: z.string().min(1),
  suggestion: z.string().min(1),
  informationType: z.enum(POLICY_INFORMATION_TYPE_VALUES),
});

const LookerParamMapSchema = z.object({
  municipio: z.string().min(1).optional(),
  classificacao: z.string().min(1).optional(),
});

const LookerParamMapByInformationTypeSchema = z.object({
  funcionarios_ao_longo_do_tempo: LookerParamMapSchema.optional(),
  saldo_funcionarios_ao_longo_do_tempo: LookerParamMapSchema.optional(),
  funcionarios_por_municipio: LookerParamMapSchema.optional(),
  estabelecimentos_por_municipio: LookerParamMapSchema.optional(),
});

const LookerInformationTypeMapSchema = z.object({
  funcionarios_ao_longo_do_tempo: z.string().min(1),
  saldo_funcionarios_ao_longo_do_tempo: z.string().min(1),
  funcionarios_por_municipio: z.string().min(1),
  estabelecimentos_por_municipio: z.string().min(1),
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
  history: z
    .object({
      /** Número máximo de turnos (user + assistant) incluídos no contexto do LLM. */
      maxMessages: z.number().int().min(1),
      /** Tempo de expiração do histórico no Redis (segundos). 0 = sem expiração. */
      ttlSeconds: z.number().int().min(0),
    })
    .default({ maxMessages: 3, ttlSeconds: 1800 }),
  curiosityFaq: z.array(CuriosityFaqEntrySchema).optional(),
  looker: z.object({
    baseUrl: z.string().url(),
    paramMap: z.record(z.enum(LOOKER_FILTER_KEY_VALUES), z.string()).default({}),
    paramMapByInformationType: LookerParamMapByInformationTypeSchema.optional(),
    informationTypeMap: LookerInformationTypeMapSchema,
  }),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;
