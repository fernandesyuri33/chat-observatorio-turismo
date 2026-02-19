import { describe, it, expect } from "vitest";
import { getSchemaEntry, getActiveVersion } from "../src/schema-registry";
import { resolveDashboardAction } from "../src/resolve-dashboard-action.usecase";
import { PolicyEngine } from "@conversational/policy";
import { StubLlmAdapter } from "@conversational/llm";
import { LookerProvider, CustomProvider } from "@conversational/providers";
import type { PolicyConfig } from "@conversational/policy";

const testPolicyConfig: PolicyConfig = {
  mode: "guided",
  minConfidence: 0.5,
  allowAmbiguity: true,
  knownMetrics: ["visitas", "ocupacao", "eventos"],
  knownDimensions: ["cidade", "ano", "mes", "indicador", "classificacao", "municipio"],
  synonyms: {
    occupancy: "ocupacao",
    visits: "visitas",
    "funcionários por município": "funcionarios_por_municipio",
  },
  activeProvider: "looker",
  fallback: {
    onSchemaInvalid: "retry_llm",
    onLowConfidence: "explain_only",
    retryCount: 1,
  },
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

describe("SchemaRegistry", () => {
  it("selects v1 by default", () => {
    const version = getActiveVersion();
    expect(version).toBe("v1");
  });

  it("returns a valid schema entry for v1", () => {
    const entry = getSchemaEntry("v1");
    expect(entry).toBeDefined();
    expect(entry.schema).toBeDefined();
    expect(typeof entry.parse).toBe("function");
  });

  it("throws for unknown version", () => {
    expect(() => getSchemaEntry("v999")).toThrow("Unknown intent schema version");
  });
});

describe("resolveDashboardAction", () => {
  function buildDeps(overrideConfig?: Partial<PolicyConfig>) {
    const config = { ...testPolicyConfig, ...overrideConfig };
    const policyEngine = new PolicyEngine(config);
    const llm = new StubLlmAdapter();
    const provider = config.activeProvider === "custom"
      ? new CustomProvider()
      : new LookerProvider(config.looker);
    return { llm, policyEngine, provider };
  }

  it("returns open_url with informationType page mapping and params", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários por município em Pouso Alegre",
    });
    expect(result.type).toBe("open_url");
    if (result.type === "open_url") {
      expect(result.url).toContain("/page/p_funcionarios_municipio");
      expect(result.url).toContain("params=");
    }
  });

  it("returns run_query when activeProvider is custom", async () => {
    const deps = buildDeps({ activeProvider: "custom" });
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários por município",
    });
    expect(result.type).toBe("run_query");
  });

  it("returns explain_only on INVALID LLM output (fallback)", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "INVALID request",
    });
    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toContain("resposta inválida");
    }
  });

  it("returns explain_only on low confidence", async () => {
    const deps = buildDeps({ minConfidence: 0.9 });

    const result = await resolveDashboardAction(
      deps,
      { message: "something generic" }
    );
    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toContain("Baixa confiança");
    }
  });
});
