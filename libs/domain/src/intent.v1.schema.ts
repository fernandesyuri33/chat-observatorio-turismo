import { z } from "zod";

// ── Intent v1 — schema de saída estruturada do LLM ──────────────

export const INFORMATION_TYPE_VALUES = [
  "funcionarios_ao_longo_do_tempo",
  "saldo_funcionarios_ao_longo_do_tempo",
  "funcionarios_por_municipio",
  "estabelecimentos_por_municipio",
] as const;

export const InformationTypeSchema = z.enum(INFORMATION_TYPE_VALUES);

const ignoreBlankString = <T>(schema: z.ZodType<T>) =>
  z.preprocess((value) => {
    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }

    return value;
  }, schema);

export const ClassificacaoSchema = z.enum([
  "alimentação",
  "transportes",
  "comércios e serviços",
  "hospedagem",
  "entretenimento",
  "agencias e operadores",
]);

const CLASSIFICACAO_VARIANTS: Record<string, z.infer<typeof ClassificacaoSchema>> = {
  alimentação: "alimentação",
  alimentacao: "alimentação",
  transportes: "transportes",
  transporte: "transportes",
  "comércios e serviços": "comércios e serviços",
  "comercios e servicos": "comércios e serviços",
  "comercios e serviços": "comércios e serviços",
  "comércios e servicos": "comércios e serviços",
  comercios: "comércios e serviços",
  hospedagem: "hospedagem",
  entretenimento: "entretenimento",
  "agencias e operadores": "agencias e operadores",
  "agências e operadores": "agencias e operadores",
  "Agências e Operadores": "agencias e operadores",
};

const normalizeClassificacaoValue = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return trimmedValue;
  }

  return (
    CLASSIFICACAO_VARIANTS[trimmedValue] ??
    CLASSIFICACAO_VARIANTS[trimmedValue.toLowerCase()] ??
    trimmedValue
  );
};

export const IntentV1FiltersSchema = z.object({
  classificacao: z.preprocess(
    normalizeClassificacaoValue,
    ignoreBlankString(ClassificacaoSchema.nullable().optional())
  ),
  municipio: ignoreBlankString(z.string().min(1).nullable().optional()),
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
