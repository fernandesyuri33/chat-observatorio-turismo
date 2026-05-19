import { describe, it, expect } from "vitest";
import { resolveDashboardAction } from "../src/resolve-dashboard-action.usecase";
import { getSchemaEntry, getActiveVersion } from "../src/schema-registry";
import { PolicyEngine } from "@conversational/policy";
import { StubLlmAdapter } from "@conversational/llm";
import { LookerProvider, CustomProvider } from "@conversational/providers";
import type { LlmPort } from "@conversational/llm";
import type { PolicyConfig } from "@conversational/policy";
import type {
  DashboardAction,
  ExtractionResult,
  IntentV1,
  RequestStateResult,
} from "@conversational/domain";
import type { ActionProvider } from "@conversational/providers";
import {
  baseTestPolicyConfig,
  runResolveDashboardActionSharedSuite,
} from "./resolve-dashboard-action.shared";

const testPolicyConfig: PolicyConfig = baseTestPolicyConfig;

class ScriptedLlm implements LlmPort {
  private currentCall = 0;

  constructor(private readonly responses: Array<unknown | Error>) {}

  async generateStructured<T>(): Promise<T> {
    const response = this.responses[this.currentCall++];

    if (response instanceof Error) {
      throw response;
    }

    if (response === undefined) {
      throw new Error("Resposta não configurada para a chamada do LLM");
    }

    return response as T;
  }
}

class ThrowingProvider implements ActionProvider {
  readonly id = "throwing";

  async generate(_intent: IntentV1): Promise<DashboardAction> {
    throw new Error("Provider failure");
  }
}

class InvalidActionProvider implements ActionProvider {
  readonly id = "invalid";

  async generate(_intent: IntentV1): Promise<DashboardAction> {
    return { type: "open_url" } as DashboardAction;
  }
}

function makeRequestStateResult(
  overrides: Partial<RequestStateResult> = {}
): RequestStateResult {
  return {
    requestState: "complete_show",
    confidence: 0.9,
    rationale: "Pedido completo",
    ...overrides,
  };
}

function makeExtractionResult(
  overrides: Partial<ExtractionResult> = {}
): ExtractionResult {
  return {
    candidateInformationType: "funcionarios_por_municipio",
    proposedFilters: {},
    confidence: 0.8,
    rationale: "Extração válida",
    ...overrides,
  };
}

describe("Registro de schemas", () => {
  it("seleciona v1 por padrão", () => {
    const version = getActiveVersion();
    expect(version).toBe("v1");
  });

  it("retorna uma entrada de schema válida para v1", () => {
    const entry = getSchemaEntry("v1");
    expect(entry).toBeDefined();
    expect(entry.schema).toBeDefined();
    expect(typeof entry.parse).toBe("function");
  });

  it("lança erro para versão desconhecida", () => {
    expect(() => getSchemaEntry("v999")).toThrow("Versão de schema de intent desconhecida");
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

  it("retorna orientação inicial quando a classificação do request falha", async () => {
    const policyEngine = new PolicyEngine(testPolicyConfig);
    const llm = new ScriptedLlm([new Error("Falha na etapa 1")]);
    const provider = new LookerProvider(testPolicyConfig.looker);

    const result = await resolveDashboardAction({ llm, policyEngine, provider }, {
      message: "Mostre funcionários por município",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("retorna orientação inicial quando a extração falha", async () => {
    const policyEngine = new PolicyEngine(testPolicyConfig);
    const llm = new ScriptedLlm([
      makeRequestStateResult(),
      new Error("Falha na etapa 2"),
    ]);
    const provider = new LookerProvider(testPolicyConfig.looker);

    const result = await resolveDashboardAction({ llm, policyEngine, provider }, {
      message: "Mostre funcionários por município",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("mantém a ação principal válida quando a mensagem amigável falha", async () => {
    const policyEngine = new PolicyEngine(testPolicyConfig);
    const llm = new ScriptedLlm([
      makeRequestStateResult(),
      makeExtractionResult({
        candidateInformationType: "funcionarios_por_municipio",
        proposedFilters: { municipio: "Poços de Caldas" },
      }),
      new Error("Falha na etapa 4"),
    ]);
    const provider = new LookerProvider(testPolicyConfig.looker);

    const result = await resolveDashboardAction({ llm, policyEngine, provider }, {
      message: "Mostre funcionários por município em Poços de Caldas",
    });

    expect(result.type).toBe("open_url");
    if (result.type === "open_url") {
      expect(result.url).toContain("/page/p_funcionarios_municipio");
      expect(result.url).toContain("params=");
      expect(result.message).toBeUndefined();
    }
  });

  it("retorna orientação inicial quando o provider lança erro", async () => {
    const policyEngine = new PolicyEngine(testPolicyConfig);
    const llm = new ScriptedLlm([
      makeRequestStateResult(),
      makeExtractionResult(),
    ]);
    const provider = new ThrowingProvider();

    const result = await resolveDashboardAction({ llm, policyEngine, provider }, {
      message: "Mostre funcionários por município",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("retorna orientação inicial quando o provider devolve ação inválida", async () => {
    const policyEngine = new PolicyEngine(testPolicyConfig);
    const llm = new ScriptedLlm([
      makeRequestStateResult(),
      makeExtractionResult(),
    ]);
    const provider = new InvalidActionProvider();

    const result = await resolveDashboardAction({ llm, policyEngine, provider }, {
      message: "Mostre funcionários por município",
    });

    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toBeTruthy();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    }
  });

  runResolveDashboardActionSharedSuite(buildDeps);
});
