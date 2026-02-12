import { z } from "zod";

export const CITY_LIST = [
  "Sao Paulo",
  "Rio de Janeiro",
  "Belo Horizonte",
  "Curitiba",
  "Porto Alegre",
  "Salvador",
  "Brasilia"
] as const;

export const INDICATORS = ["visitas", "ocupacao", "eventos"] as const;

export const YearSchema = z.number().int().min(2018).max(2026);
export const MonthSchema = z.number().int().min(1).max(12);

export const FiltersSchema = z.object({
  cidade: z.enum(CITY_LIST).optional(),
  ano: z.array(YearSchema).nonempty().optional(),
  mes: z.array(MonthSchema).nonempty().optional(),
  indicador: z.enum(INDICATORS).optional()
});

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("set_filters"),
    filters: FiltersSchema
  }),
  z.object({
    type: z.literal("reset_filters")
  }),
  z.object({
    type: z.literal("describe_metric"),
    indicador: z.enum(INDICATORS)
  }),
  z.object({
    type: z.literal("unknown"),
    reason: z.string(),
    suggestions: z.array(z.string()).max(5)
  })
]);

export type Filters = z.infer<typeof FiltersSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Indicator = (typeof INDICATORS)[number];
