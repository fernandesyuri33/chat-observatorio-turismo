import { it, expect } from "vitest";
import { resolveDashboardAction } from "../src/resolve-dashboard-action.usecase";
import type { ResolveDashboardActionDeps } from "../src/resolve-dashboard-action.usecase";
import type { PolicyConfig } from "@conversational/policy";

function parseUrlAndParams(urlString: string): {
  url: URL;
  params: Record<string, unknown> | null;
} {
  const url = new URL(urlString);
  const rawParams = url.searchParams.get("params");

  return {
    url,
    params: rawParams ? JSON.parse(rawParams) as Record<string, unknown> : null,
  };
}

function assertOptionalFriendlyMessage(result: { message?: unknown }): void {
  expect(
    result.message === undefined || typeof result.message === "string"
  ).toBe(true);
}

const showCases = [
  {
    message: "Mostre estabelecimentos por município",
    expectedPage: "/page/p_estabelecimentos",
    expectedInformationType: "estabelecimentos_por_municipio",
  },
  {
    message: "Mostre funcionários por município",
    expectedPage: "/page/p_funcionarios_municipio",
    expectedInformationType: "funcionarios_por_municipio",
  },
  {
    message: "Mostre funcionários ao longo do tempo",
    expectedPage: "/page/p_funcionarios_tempo",
    expectedInformationType: "funcionarios_ao_longo_do_tempo",
  },
  {
    message: "Mostre saldo de funcionários ao longo do tempo",
    expectedPage: "/page/p_saldo_funcionarios_tempo",
    expectedInformationType: "saldo_funcionarios_ao_longo_do_tempo",
  },
] as const;

const contextualOrientationMessages = [
  "Quero ver dados de Poços de Caldas",
  "Tenho interesse em hospedagem",
  "Quero analisar alimentação em Pouso Alegre",
] as const;

const curiosityFaqMessages = [
  "O setor turístico de Poços de Caldas está evoluindo?",
] as const;

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
      const { url, params } = parseUrlAndParams(result.url);
      expect(url.pathname).toContain("/page/p_funcionarios_municipio");
      expect(params).toEqual({ city: "Pouso Alegre" });
      assertOptionalFriendlyMessage(result);
    }
  }, timeout);

  for (const showCase of showCases) {
    it(`retorna open_url para ${showCase.expectedInformationType}`, async () => {
      const deps = buildDeps();
      const result = await resolveDashboardAction(deps, {
        message: showCase.message,
      });

      expect(result.type).toBe("open_url");
      if (result.type === "open_url") {
        const { url, params } = parseUrlAndParams(result.url);
        expect(url.pathname).toContain(showCase.expectedPage);
        expect(params).toBeNull();
        expect(result.meta?.["informationType"]).toBe(showCase.expectedInformationType);
        assertOptionalFriendlyMessage(result);
      }
    }, timeout);
  }

  it("aplica filtro de município no parâmetro params", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários por município em Poços de Caldas",
    });

    expect(result.type).toBe("open_url");
    if (result.type === "open_url") {
      const { url, params } = parseUrlAndParams(result.url);
      expect(url.pathname).toContain("/page/p_funcionarios_municipio");
      expect(params).toEqual({ city: "Poços de Caldas" });
      assertOptionalFriendlyMessage(result);
    }
  }, timeout);

  it("aplica filtro de classificação no parâmetro params", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Mostre estabelecimentos de hospedagem por município",
    });

    expect(result.type).toBe("open_url");
    if (result.type === "open_url") {
      const { url, params } = parseUrlAndParams(result.url);
      expect(url.pathname).toContain("/page/p_estabelecimentos");
      expect(params).toEqual({ classification: "hospedagem" });
      assertOptionalFriendlyMessage(result);
    }
  }, timeout);

  it("aplica município e classificação juntos no parâmetro params", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Mostre estabelecimentos de alimentação em Poços de Caldas",
    });

    expect(result.type).toBe("open_url");
    if (result.type === "open_url") {
      const { url, params } = parseUrlAndParams(result.url);
      expect(url.pathname).toContain("/page/p_estabelecimentos");
      expect(params).toEqual({
        classification: "alimentação",
        city: "Poços de Caldas",
      });
      assertOptionalFriendlyMessage(result);
    }
  }, timeout);

  it("retorna URL sem params quando não houver filtro", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários ao longo do tempo",
    });

    expect(result.type).toBe("open_url");
    if (result.type === "open_url") {
      const { url, params } = parseUrlAndParams(result.url);
      expect(url.pathname).toContain("/page/p_funcionarios_tempo");
      expect(url.searchParams.get("params")).toBeNull();
      expect(params).toBeNull();
      assertOptionalFriendlyMessage(result);
    }
  }, timeout);

  it("retorna run_query quando activeProvider é custom", async () => {
    const deps = buildDeps({ activeProvider: "custom" });
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários por município",
    });
    expect(result.type).toBe("run_query");
    if (result.type === "run_query") {
      expect(result.function).toBe("tourism.resolve");
      expect(result.args).toMatchObject({
        intent: {
          intent: "show",
          informationType: "funcionarios_por_municipio",
          proposedFilters: {},
        },
      });
      assertOptionalFriendlyMessage(result);
    }
  }, timeout);

  it("retorna orientação inicial para mensagem vaga de ajuda", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "ajuda",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    }
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

  it("retorna explain_only para pedido claro de orientação inicial", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "O que posso analisar aqui?",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
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

  for (const message of contextualOrientationMessages) {
    it(`retorna orientação contextual para '${message}'`, async () => {
      const deps = buildDeps();
      const result = await resolveDashboardAction(deps, {
        message,
      });

      expect(result.type).toBe("explain_only");
      if (result.type === "explain_only") {
        expect(result.message).toBeTruthy();
        expect(result.suggestions.length).toBeGreaterThan(0);
      }
    }, timeout);
  }

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

  for (const message of curiosityFaqMessages) {
    it(`retorna resposta de curiosity_to_action a partir do FAQ para '${message}'`, async () => {
      const deps = buildDeps();
      const result = await resolveDashboardAction(deps, {
        message,
      });

      expect(result.type).toBe("explain_only");
      if (result.type === "explain_only") {
        expect(result.message).toBeTruthy();
        expect(result.suggestions).toContain(
          "Visualizar a quantidade de funcionários ao longo do tempo"
        );
      }
    }, timeout);
  }

  it("faz fallback para orientação inicial quando a intent de curiosidade não tem correspondência no FAQ", async () => {
    const deps = buildDeps({ curiosityFaq: [] });
    const result = await resolveDashboardAction(deps, {
      message: "O setor turístico de Poços de Caldas está evoluindo?",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
      expect(result.suggestions).not.toContain(
        "Visualizar a quantidade de funcionários ao longo do tempo"
      );
    }
  }, timeout);
}
