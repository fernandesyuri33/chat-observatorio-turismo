import { describe, expect, it } from "vitest";
import { PolicyEngine } from "../src/policy-engine";
import type { PolicyConfig } from "../src/policy-config.schema";

function buildPolicyConfig(overrides?: Partial<PolicyConfig>): PolicyConfig {
  return {
    minConfidence: 0.5,
    synonyms: {},
    activeProvider: "looker",
    fallback: {
      retryCount: 1,
      contextualOrientationOptionCount: 3,
    },
    history: {
      maxMessages: 3,
      ttlSeconds: 1800,
    },
    curiosityFaq: [],
    looker: {
      baseUrl: "https://datastudio.google.com/embed/reporting/abc123/page/p_1",
      paramMap: {
        classificacao: "classification",
        municipio: "city",
      },
      informationTypeMap: {
        estabelecimentos_por_municipio: "p_estabelecimentos",
        funcionarios_por_municipio: "p_funcionarios_municipio",
        funcionarios_ao_longo_do_tempo: "p_funcionarios_tempo",
        saldo_funcionarios_ao_longo_do_tempo: "p_saldo_funcionarios_tempo",
      },
    },
    ...overrides,
  };
}

describe("PolicyEngine", () => {
  it("descarta filtro desconhecido", () => {
    const engine = new PolicyEngine(buildPolicyConfig());

    const result = engine.normalizeExtraction({
      proposedFilters: {
        municipio: "Poços de Caldas",
        ano: "2024",
        classificacao: "hospedagem",
      },
      confidence: 0.8,
    });

    expect(result.proposedFilters).toEqual({
      municipio: "Poços de Caldas",
      classificacao: "hospedagem",
    });
  });

  it("normaliza a chave classificação para classificacao", () => {
    const engine = new PolicyEngine(buildPolicyConfig({
      synonyms: {
        classificação: "classificacao",
      },
    }));

    const result = engine.normalizeExtraction({
      proposedFilters: {
        classificação: "hospedagem",
      },
      confidence: 0.8,
    });

    expect(result.proposedFilters).toEqual({
      classificacao: "hospedagem",
    });
  });

  it("descarta classificação inválida", () => {
    const engine = new PolicyEngine(buildPolicyConfig());

    const result = engine.normalizeExtraction({
      proposedFilters: {
        classificacao: "praias",
      },
      confidence: 0.8,
    });

    expect(result.proposedFilters.classificacao).toBeUndefined();
    expect(result.proposedFilters).toEqual({});
  });

  it("mantém município não vazio", () => {
    const engine = new PolicyEngine(buildPolicyConfig());

    const result = engine.normalizeExtraction({
      proposedFilters: {
        municipio: "Poços de Caldas",
      },
      confidence: 0.8,
    });

    expect(result.proposedFilters).toEqual({
      municipio: "Poços de Caldas",
    });
  });

  it("descarta município vazio", () => {
    const engine = new PolicyEngine(buildPolicyConfig());

    const result = engine.normalizeExtraction({
      proposedFilters: {
        municipio: "",
      },
      confidence: 0.8,
    });

    expect(result.proposedFilters.municipio).toBeUndefined();
    expect(result.proposedFilters).toEqual({});
  });
});