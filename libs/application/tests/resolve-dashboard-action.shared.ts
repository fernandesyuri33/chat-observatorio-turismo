import { it, expect } from "vitest";
import { resolveDashboardAction } from "../src/resolve-dashboard-action.usecase";
import type { ResolveDashboardActionDeps } from "../src/resolve-dashboard-action.usecase";
import type { PolicyConfig } from "@conversational/policy";

export const baseTestPolicyConfig: PolicyConfig = {
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
    contextualOrientationOptionCount: 3,
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

interface SharedSuiteOptions {
  testTimeout?: number;
}

type BuildDeps = (overrideConfig?: Partial<PolicyConfig>) => ResolveDashboardActionDeps;

export function runResolveDashboardActionSharedSuite(
  buildDeps: BuildDeps,
  options: SharedSuiteOptions = {}
): void {
  const timeout = options.testTimeout;

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
  }, timeout);

  it("returns run_query when activeProvider is custom", async () => {
    const deps = buildDeps({ activeProvider: "custom" });
    const result = await resolveDashboardAction(deps, {
      message: "Mostre funcionários por município",
    });
    expect(result.type).toBe("run_query");
  }, timeout);

  it("returns explain_only for open onboarding questions", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "O que posso analisar ou descobrir aqui?",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      const isOrientationMessage = result.message.includes("caminhos de exploração");
      const isLowConfidenceMessage = result.message.includes("Baixa confiança");

      expect(isOrientationMessage || isLowConfidenceMessage).toBe(true);

      if (isOrientationMessage) {
        expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
        expect(result.suggestions.join(" ")).toContain("funcionários");
      } else {
        expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
      }
    }
  }, timeout);

  it("returns contextual orientation when user provides only filter context", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Quero ver dados de Poços de Caldas",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toContain("A partir desse recorte, você pode explorar");
      expect(result.suggestions).toEqual([
        "Quantidade de funcionários ao longo do tempo",
        "Saldo de funcionários ao longo do tempo",
        "Quantidade de funcionários por município",
      ]);
    }
  }, timeout);

  it("limits contextual orientation suggestions using policy config", async () => {
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
}
