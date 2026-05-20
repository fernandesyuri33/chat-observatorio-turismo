import { describe, expect, it } from "vitest";
import { LookerProvider } from "../src/looker/looker-provider";
import type { PolicyConfig } from "@conversational/policy";
import type { IntentV1 } from "@conversational/domain";

const lookerConfig: PolicyConfig["looker"] = {
  baseUrl: "https://datastudio.google.com/embed/reporting/abc123/page/p_1",
  paramMap: {},
  paramMapByInformationType: {
    estabelecimentos_por_municipio: {
      municipio: "ds19.p_municipio",
      classificacao: "ds19.p_classificacao",
    },
    funcionarios_por_municipio: {
      municipio: "ds17.p_municipio",
      classificacao: "ds17.p_classificacao",
    },
    funcionarios_ao_longo_do_tempo: {
      municipio: "ds18.p_municipio",
      classificacao: "ds18.p_classificacao",
    },
    saldo_funcionarios_ao_longo_do_tempo: {
      municipio: "ds20.p_municipio",
      classificacao: "ds20.p_classificacao",
    },
  },
  informationTypeMap: {
    estabelecimentos_por_municipio: "p_estabelecimentos",
    funcionarios_por_municipio: "p_funcionarios_municipio",
    funcionarios_ao_longo_do_tempo: "p_funcionarios_tempo",
    saldo_funcionarios_ao_longo_do_tempo: "p_saldo_funcionarios_tempo",
  },
};

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

function buildShowIntent(overrides: Partial<Extract<IntentV1, { intent: "show" }>> = {}): IntentV1 {
  return {
    intent: "show",
    informationType: "funcionarios_por_municipio",
    proposedFilters: {},
    confidence: 0.8,
    rationale: "Teste",
    ...overrides,
  };
}

describe("LookerProvider", () => {
  const provider = new LookerProvider(lookerConfig);

  const informationTypeCases = [
    {
      informationType: "estabelecimentos_por_municipio",
      expectedPage: "/page/p_estabelecimentos",
    },
    {
      informationType: "funcionarios_por_municipio",
      expectedPage: "/page/p_funcionarios_municipio",
    },
    {
      informationType: "funcionarios_ao_longo_do_tempo",
      expectedPage: "/page/p_funcionarios_tempo",
    },
    {
      informationType: "saldo_funcionarios_ao_longo_do_tempo",
      expectedPage: "/page/p_saldo_funcionarios_tempo",
    },
  ] as const;

  for (const testCase of informationTypeCases) {
    it(`mapeia ${testCase.informationType} para a página correta`, async () => {
      const action = await provider.generate(buildShowIntent({
        informationType: testCase.informationType,
      }));

      expect(action.type).toBe("open_url");
      if (action.type === "open_url") {
        const { url, params } = parseUrlAndParams(action.url);
        expect(url.pathname).toContain(testCase.expectedPage);
        expect(params).toBeNull();
        expect(action.meta?.["informationType"]).toBe(testCase.informationType);
      }
    });
  }

  it("serializa filtros em params", async () => {
    const action = await provider.generate(buildShowIntent({
      informationType: "estabelecimentos_por_municipio",
      proposedFilters: {
        municipio: "Poços de Caldas",
        classificacao: "hospedagem",
      },
    }));

    expect(action.type).toBe("open_url");
    if (action.type === "open_url") {
      const { url, params } = parseUrlAndParams(action.url);
      expect(url.pathname).toContain("/page/p_estabelecimentos");
      expect(params).toEqual({
        "ds19.p_municipio": "Poços de Caldas",
        "ds19.p_classificacao": "Hospedagem",
      });
    }
  });

  it("serializa apenas o filtro informado para o recorte atual", async () => {
    const action = await provider.generate(buildShowIntent({
      informationType: "funcionarios_por_municipio",
      proposedFilters: {
        municipio: "Pouso Alegre",
      },
    }));

    expect(action.type).toBe("open_url");
    if (action.type === "open_url") {
      const { url, params } = parseUrlAndParams(action.url);
      expect(url.pathname).toContain("/page/p_funcionarios_municipio");
      expect(params).toEqual({
        "ds17.p_municipio": "Pouso Alegre",
      });
    }
  });
});