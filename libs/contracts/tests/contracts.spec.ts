import { describe, expect, it } from "vitest";
import {
  PostMensagemRequestSchema,
  PostMensagemResponseSchema,
} from "../src/index";

describe("PostMensagemRequestSchema", () => {
  it("aceita uma requisição válida", () => {
    const result = PostMensagemRequestSchema.safeParse({
      message: "Quero visitas em Sao Paulo em 2024",
    });

    expect(result.success).toBe(true);
  });

  it("rejeita campos extras", () => {
    const result = PostMensagemRequestSchema.safeParse({
      message: "Quero visitas em Sao Paulo em 2024",
      ctx: {
        dashboardId: "turismo-main",
      },
    });

    expect(result.success).toBe(false);
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
        stage1: {
          rationale: "Usuário pediu orientação geral.",
          classification: "initial_orientation",
          confidence: 0.95,
        },
        stage2: {
          rationale: "Nenhum filtro identificado.",
          informationType: "funcionarios_por_municipio",
          filters: { municipio: "São Paulo" },
          confidence: 0.8,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rationale?.stage1?.rationale).toBe("Usuário pediu orientação geral.");
      expect(result.data.rationale?.stage1?.classification).toBe("initial_orientation");
      expect(result.data.rationale?.stage1?.confidence).toBe(0.95);
      expect(result.data.rationale?.stage2?.informationType).toBe("funcionarios_por_municipio");
      expect(result.data.rationale?.stage2?.confidence).toBe(0.8);
    }
  });
});
