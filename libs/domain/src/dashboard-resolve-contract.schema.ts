import { z } from "zod";
import { DashboardActionSchema } from "./dashboard-action.schema.js";

export const ResolveDashboardRequestSchema = z.object({
  message: z.string().min(1),
  ctx: z
    .object({
      dashboardId: z.string().optional(),
      currentFilters: z.record(z.any()).optional(),
    })
    .optional(),
});

export const ResolveDashboardResponseSchema = z.object({
  action: DashboardActionSchema,
});

export type ResolveDashboardRequest = z.infer<typeof ResolveDashboardRequestSchema>;
export type ResolveDashboardResponse = z.infer<typeof ResolveDashboardResponseSchema>;
