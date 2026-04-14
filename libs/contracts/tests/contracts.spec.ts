import { describe, expect, it } from "vitest";
import {
  PostMensagemRequestSchema,
  PostMensagemResponseSchema,
} from "../src/index";

describe("PostMensagemRequestSchema", () => {
  it("aceita uma requisição válida", () => {
    const result = PostMensagemRequestSchema.safeParse({
      message: "Quero visitas em Sao Paulo em 2024",
      ctx: {
        dashboardId: "turismo-main",
        currentFilters: { cidade: "Rio de Janeiro" },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejeita mensagem vazia", () => {
    const result = PostMensagemRequestSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });
});

describe("PostMensagemResponseSchema", () => {
  it("aceita uma resposta válida", () => {
    const result = PostMensagemResponseSchema.safeParse({
      action: {
        type: "explain_only",
        message: "Não consegui interpretar.",
        suggestions: ["Tente reformular sua pergunta"],
      },
    });

    expect(result.success).toBe(true);
  });

  it("aceita resposta com rationale das etapas", () => {
    const result = PostMensagemResponseSchema.safeParse({
      action: {
        type: "explain_only",
        message: "Orientação inicial.",
        suggestions: [],
      },
      rationale: {
        stage1: "Usuário pediu orientação geral.",
        stage2: "Nenhum filtro identificado.",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rationale?.stage1).toBe("Usuário pediu orientação geral.");
      expect(result.data.rationale?.stage2).toBe("Nenhum filtro identificado.");
    }
  });
});
