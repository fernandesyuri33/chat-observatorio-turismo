import { describe, expect, it } from "vitest";
import {
  ResolveDashboardRequestSchema,
  ResolveDashboardResponseSchema,
} from "../src/index";

describe("ResolveDashboardRequestSchema", () => {
  it("aceita uma requisição válida", () => {
    const result = ResolveDashboardRequestSchema.safeParse({
      message: "Quero visitas em Sao Paulo em 2024",
      ctx: {
        dashboardId: "turismo-main",
        currentFilters: { cidade: "Rio de Janeiro" },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejeita mensagem vazia", () => {
    const result = ResolveDashboardRequestSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });
});

describe("ResolveDashboardResponseSchema", () => {
  it("aceita uma resposta válida", () => {
    const result = ResolveDashboardResponseSchema.safeParse({
      action: {
        type: "explain_only",
        message: "Não consegui interpretar.",
        suggestions: ["Tente reformular sua pergunta"],
      },
    });

    expect(result.success).toBe(true);
  });
});
