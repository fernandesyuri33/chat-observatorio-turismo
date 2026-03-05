import { z } from "zod";
import { DashboardActionSchema } from "@conversational/domain";

export const PostMensagemRequestSchema = z.object({
  message: z.string().min(1),
  ctx: z
    .object({
      dashboardId: z.string().optional(),
      currentFilters: z.record(z.any()).optional(),
    })
    .optional(),
});

export const PostMensagemResponseSchema = z.object({
  action: DashboardActionSchema,
});

export type ResolveDashboardRequest = z.infer<typeof PostMensagemRequestSchema>;
export type ResolveDashboardResponse = z.infer<typeof PostMensagemResponseSchema>;
