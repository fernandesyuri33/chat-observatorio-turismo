import { it, expect } from "vitest";
import { resolveDashboardAction } from "../src/resolve-dashboard-action.usecase";
import type { ResolveDashboardActionDeps } from "../src/resolve-dashboard-action.usecase";
import type { PolicyConfig } from "@conversational/policy";

export const baseTestPolicyConfig: PolicyConfig = {
  minConfidence: 0.5,
  synonyms: {
    "funcionários por município": "funcionarios_por_municipio",
  },
  activeProvider: "looker",
  fallback: {
    retryCount: 1,
    contextualOrientationOptionCount: 3,
  },
  history: {
    maxMessages: 3,
    ttlSeconds: 1800,
  },
  curiosityFaq: [
    {
      questionExamples: [
        "O setor turístico de Poços de Caldas está evoluindo?",
        "O turismo de Poços de Caldas está crescendo?",
      ],
      response:
        "Uma forma de explorar essa questão é visualizar a evolução da quantidade de funcionários ao longo do tempo. Deseja ajustar o dashboard para esse recorte?",
      suggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
      informationType: "funcionarios_ao_longo_do_tempo",
    },
  ],
  looker: {
    baseUrl: "https://lookerstudio.google.com/embed/reporting/abc123/page/p_1",
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
};

interface SharedSuiteOptions {
  testTimeout?: number;
}

type BuildDeps = (overrideConfig?: Partial<PolicyConfig>) => ResolveDashboardActionDeps;

export function runResolveDashboardActionSharedSuite(
  buildDeps: BuildDeps,
  options: SharedSuiteOptions = {}
): void {
  const timeout = options.testTimeout;

  it("retorna open_url com mapeamento de página por informationType e params", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários por município em Pouso Alegre",
    });
    expect(result.type).toBe("open_url");
    if (result.type === "open_url") {
      expect(result.url).toContain("/page/p_funcionarios_municipio");
      expect(result.url).toContain("params=");
    }
  }, timeout);

  it("retorna run_query quando activeProvider é custom", async () => {
    const deps = buildDeps({ activeProvider: "custom" });
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários por município",
    });
    expect(result.type).toBe("run_query");
  }, timeout);

  it("retorna orientação inicial para perguntas abertas de onboarding", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "O que posso analisar ou descobrir aqui?",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
      expect(result.suggestions.join(" ")).toContain("funcionários");
    }
  }, timeout);

  it("retorna orientação contextual quando o usuário fornece apenas contexto de filtro", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Quero ver dados de Poços de Caldas",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions).toEqual([
        "Quantidade de funcionários ao longo do tempo",
        "Saldo de funcionários ao longo do tempo",
        "Quantidade de funcionários por município",
      ]);
    }
  }, timeout);

  it("limita sugestões de orientação contextual usando a configuração de política", async () => {
    const deps = buildDeps({
      fallback: {
        ...baseTestPolicyConfig.fallback,
        contextualOrientationOptionCount: 2,
      },
    });

    const result = await resolveDashboardAction(deps, {
      message: "Quero ver dados de Poços de Caldas",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.suggestions).toEqual([
        "Quantidade de funcionários ao longo do tempo",
        "Saldo de funcionários ao longo do tempo",
      ]);
    }
  }, timeout);

  it("retorna resposta de curiosity_to_action a partir do FAQ configurado", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "O setor turístico de Poços de Caldas está evoluindo?",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions).toEqual([
        "Visualizar a quantidade de funcionários ao longo do tempo",
      ]);
    }
  }, timeout);

  it("faz fallback para orientação inicial quando a intent de curiosidade não tem correspondência no FAQ", async () => {
    const deps = buildDeps({ curiosityFaq: [] });
    const result = await resolveDashboardAction(deps, {
      message: "O setor turístico de Poços de Caldas está evoluindo?",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    }
  }, timeout);
}
