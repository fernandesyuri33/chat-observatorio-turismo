import { z } from "zod";
import {
  InformationTypeSchema,
  IntentV1FiltersSchema,
} from "./intent.v1.schema.js";

// ── Extraction Result — extração semântica estruturada (Etapa 2) ─

/**
 * Schema de saída do LLM para a Etapa 2 (Structured Extraction).
 * Extrai informationType candidato e filtros propostos, sem decidir a resposta.
 */
export const ExtractionResultSchema = z.object({
  candidateInformationType: InformationTypeSchema.optional(),
  proposedFilters: IntentV1FiltersSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
