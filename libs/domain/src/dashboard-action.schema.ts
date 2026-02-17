import { z } from "zod";

// ── DashboardAction discriminated union ─────────────────────────

export const OpenUrlActionSchema = z.object({
  type: z.literal("open_url"),
  url: z.string().url(),
  title: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export const ApplyFiltersActionSchema = z.object({
  type: z.literal("apply_filters"),
  filters: z.record(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
  ),
  target: z
    .enum(["dashboard", "chart", "table"])
    .optional(),
  meta: z.record(z.any()).optional(),
});

export const RunQueryActionSchema = z.object({
  type: z.literal("run_query"),
  function: z.string(),
  args: z.record(z.any()),
  meta: z.record(z.any()).optional(),
});

export const ExplainOnlyActionSchema = z.object({
  type: z.literal("explain_only"),
  message: z.string(),
  suggestions: z.array(z.string()),
  meta: z.record(z.any()).optional(),
});

export const DashboardActionSchema = z.discriminatedUnion("type", [
  OpenUrlActionSchema,
  ApplyFiltersActionSchema,
  RunQueryActionSchema,
  ExplainOnlyActionSchema,
]);

export type DashboardAction = z.infer<typeof DashboardActionSchema>;
export type OpenUrlAction = z.infer<typeof OpenUrlActionSchema>;
export type ApplyFiltersAction = z.infer<typeof ApplyFiltersActionSchema>;
export type RunQueryAction = z.infer<typeof RunQueryActionSchema>;
export type ExplainOnlyAction = z.infer<typeof ExplainOnlyActionSchema>;
