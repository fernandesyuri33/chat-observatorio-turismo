import { z } from "zod";
import { DashboardActionSchema } from "@conversational/domain";

export const PostMensagemRequestSchema = z.object({
  message: z.string().min(1),
}).strict();

const StageClassificationSchema = z.object({
  rationale: z.string().optional(),
  classification: z.string().optional(),
  confidence: z.number().optional(),
});

const StageExtractionSchema = z.object({
  rationale: z.string().optional(),
  informationType: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
  confidence: z.number().optional(),
});

export const PostMensagemResponseSchema = z.object({
  action: DashboardActionSchema,
  rationale: z
    .object({
      stage1: StageClassificationSchema.optional(),
      stage2: StageExtractionSchema.optional(),
    })
    .optional(),
});

export type ResolveDashboardRequest = z.infer<typeof PostMensagemRequestSchema>;
export type ResolveDashboardResponse = z.infer<typeof PostMensagemResponseSchema>;
