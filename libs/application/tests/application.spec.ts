import { describe, it, expect } from "vitest";
import { getSchemaEntry, getActiveVersion } from "../src/schema-registry";
import { ProviderRouter } from "../src/provider-router";
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
  knownDimensions: ["cidade", "ano", "mes", "indicador"],
  synonyms: {
    occupancy: "ocupacao",
    visits: "visitas",
  },
  routing: {
    filter: "looker",
    trend: "looker",
    help: "custom",
    topN: "custom",
    compare: "looker",
  },
  fallback: {
    onSchemaInvalid: "retry_llm",
    onLowConfidence: "explain_only",
    retryCount: 1,
  },
  looker: {
    baseUrl: "https://lookerstudio.google.com/embed/reporting/abc123/page/p_1",
    paramMap: {
      cidade: "city",
      ano: "year",
      mes: "month",
      indicador: "indicator",
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

describe("ProviderRouter", () => {
  it("routes filter intent to looker provider", () => {
    const looker = new LookerProvider(testPolicyConfig.looker);
    const custom = new CustomProvider();
    const router = new ProviderRouter([looker, custom], testPolicyConfig.routing);

    const provider = router.resolve("filter", {});
    expect(provider?.id).toBe("looker");
  });

  it("routes help intent to custom provider", () => {
    const looker = new LookerProvider(testPolicyConfig.looker);
    const custom = new CustomProvider();
    const router = new ProviderRouter([looker, custom], testPolicyConfig.routing);

    const provider = router.resolve("help", {});
    expect(provider?.id).toBe("custom");
  });

  it("falls back to first supporting provider for unknown intent", () => {
    const looker = new LookerProvider(testPolicyConfig.looker);
    const custom = new CustomProvider();
    const router = new ProviderRouter([looker, custom], testPolicyConfig.routing);

    const provider = router.resolve("nonexistent_intent", {});
    expect(provider).toBeDefined();
  });
});

describe("resolveDashboardAction", () => {
  function buildDeps() {
    const policyEngine = new PolicyEngine(testPolicyConfig);
    const llm = new StubLlmAdapter();
    const looker = new LookerProvider(testPolicyConfig.looker);
    const custom = new CustomProvider();
    const router = new ProviderRouter([looker, custom], testPolicyConfig.routing);
    return { llm, policyEngine, router };
  }

  it("returns open_url for occupancy request", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "Show me occupancy trends",
    });
    expect(result.type).toBe("open_url");
  });

  it("returns run_query for help request", async () => {
    const deps = buildDeps();
    const result = await resolveDashboardAction(deps, {
      message: "I need help",
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
    // Default stub returns confidence 0.6 for generic messages.
    // Set minConfidence to 0.9 to trigger low-confidence fallback.
    const highMinConfig: PolicyConfig = {
      ...testPolicyConfig,
      minConfidence: 0.9,
    };
    const policyEngine = new PolicyEngine(highMinConfig);
    const llm = new StubLlmAdapter();
    const looker = new LookerProvider(testPolicyConfig.looker);
    const custom = new CustomProvider();
    const router = new ProviderRouter([looker, custom], highMinConfig.routing);

    const result = await resolveDashboardAction(
      { llm, policyEngine, router },
      { message: "something generic" }
    );
    expect(result.type).toBe("explain_only");
    if (result.type === "explain_only") {
      expect(result.message).toContain("Baixa confiança");
    }
  });
});
