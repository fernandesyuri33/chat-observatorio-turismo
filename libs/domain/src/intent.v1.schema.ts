import { z } from "zod";

// ── Intent v1 — schema de saída estruturada do LLM ──────────────

export const INFORMATION_TYPE_VALUES = [
  "funcionarios_ao_longo_do_tempo",
  "saldo_funcionarios_ao_longo_do_tempo",
  "funcionarios_por_municipio",
  "estabelecimentos_por_municipio",
] as const;

export const InformationTypeSchema = z.enum(INFORMATION_TYPE_VALUES);

export const ClassificacaoSchema = z.enum([
  "alimentação",
  "transportes",
  "comércios e serviços",
  "hospedagem",
  "entretenimento",
  "agencias e operadores",
]);

export const IntentV1FiltersSchema = z.object({
  classificacao: ClassificacaoSchema.nullable().optional(),
  municipio: z.string().min(1).optional(),
});

const IntentV1BaseSchema = z.object({
  proposedFilters: IntentV1FiltersSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

const OmittedInformationTypeSchema = z
  .null()
  .optional()
  .transform(() => undefined);

export const ShowIntentV1Schema = IntentV1BaseSchema.extend({
  intent: z.literal("show"),
  informationType: InformationTypeSchema,
});

export const ContextualOrientationIntentV1Schema = IntentV1BaseSchema.extend({
  intent: z.literal("contextual_orientation"),
  informationType: OmittedInformationTypeSchema,
});

export const InitialOrientationIntentV1Schema = IntentV1BaseSchema.extend({
  intent: z.literal("initial_orientation"),
  informationType: OmittedInformationTypeSchema,
});

export const CuriosityToActionIntentV1Schema = IntentV1BaseSchema.extend({
  intent: z.literal("curiosity_to_action"),
  informationType: OmittedInformationTypeSchema,
});

export const IntentV1Schema = z.discriminatedUnion("intent", [
  ShowIntentV1Schema,
  ContextualOrientationIntentV1Schema,
  InitialOrientationIntentV1Schema,
  CuriosityToActionIntentV1Schema,
]);

export type InformationType = z.infer<typeof InformationTypeSchema>;
export type Classificacao = z.infer<typeof ClassificacaoSchema>;
export type IntentV1 = z.infer<typeof IntentV1Schema>;
