import { z } from "zod";
import { InformationTypeSchema, IntentV1FiltersSchema } from "./intent.v1.schema.js";

// ── Response Decision — decisão determinística de resposta (Etapa 3) ─

const ExecuteShowDecisionSchema = z.object({
  responseType: z.literal("execute_show"),
  informationType: InformationTypeSchema,
  filters: IntentV1FiltersSchema,
});

const GiveInitialOrientationDecisionSchema = z.object({
  responseType: z.literal("give_initial_orientation"),
});

const GiveContextualOrientationDecisionSchema = z.object({
  responseType: z.literal("give_contextual_orientation"),
  filters: IntentV1FiltersSchema,
});

const ConvertCuriosityToActionDecisionSchema = z.object({
  responseType: z.literal("convert_curiosity_to_action"),
  faqResponse: z.string(),
  faqSuggestion: z.string(),
  faqInformationType: InformationTypeSchema,
});

/**
 * União discriminada de decisões de resposta.
 * Produzida pelo response router (determinístico, sem LLM).
 */
export const ResponseDecisionSchema = z.discriminatedUnion("responseType", [
  ExecuteShowDecisionSchema,
  GiveInitialOrientationDecisionSchema,
  GiveContextualOrientationDecisionSchema,
  ConvertCuriosityToActionDecisionSchema,
]);

export type ResponseDecision = z.infer<typeof ResponseDecisionSchema>;
export type ExecuteShowDecision = z.infer<typeof ExecuteShowDecisionSchema>;
export type GiveInitialOrientationDecision = z.infer<typeof GiveInitialOrientationDecisionSchema>;
export type GiveContextualOrientationDecision = z.infer<typeof GiveContextualOrientationDecisionSchema>;
export type ConvertCuriosityToActionDecision = z.infer<typeof ConvertCuriosityToActionDecisionSchema>;
