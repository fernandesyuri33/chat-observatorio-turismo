import { z } from "zod";

// ── Intent v1 — LLM structured output schema ───────────────────

export const InformationTypeSchema = z.enum([
  "estabelecimentos_por_municipio",
  "funcionarios_por_municipio",
  "funcionarios_ao_longo_do_tempo",
  "saldo_funcionarios_ao_longo_do_tempo",
]);

export const ClassificacaoSchema = z.enum([
  "alimentação",
  "transportes",
  "comércios e serviços",
  "hospedagem",
  "entretenimento",
  "agencias e operadores",
]);

export const IntentV1FiltersSchema = z.object({
  classificacao: ClassificacaoSchema.optional(),
  municipio: z.string().min(1).optional(),
});

const IntentV1BaseSchema = z.object({
  proposedFilters: IntentV1FiltersSchema,
  entities: z.record(z.any()),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export const ShowIntentV1Schema = IntentV1BaseSchema.extend({
  intent: z.literal("show"),
  informationType: InformationTypeSchema,
});

export const HelpIntentV1Schema = IntentV1BaseSchema.extend({
  intent: z.literal("help"),
  informationType: z.never().optional(),
});

export const IntentV1Schema = z.discriminatedUnion("intent", [
  ShowIntentV1Schema,
  HelpIntentV1Schema,
]);

export type InformationType = z.infer<typeof InformationTypeSchema>;
export type Classificacao = z.infer<typeof ClassificacaoSchema>;
export type IntentV1 = z.infer<typeof IntentV1Schema>;
