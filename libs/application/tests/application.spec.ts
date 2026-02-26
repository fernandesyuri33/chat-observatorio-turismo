import { describe, it, expect } from "vitest";
import { getSchemaEntry, getActiveVersion } from "../src/schema-registry";
import { PolicyEngine } from "@conversational/policy";
import { StubLlmAdapter } from "@conversational/llm";
import { LookerProvider, CustomProvider } from "@conversational/providers";
import type { PolicyConfig } from "@conversational/policy";
import {
  baseTestPolicyConfig,
  runResolveDashboardActionSharedSuite,
} from "./resolve-dashboard-action.shared";

const testPolicyConfig: PolicyConfig = baseTestPolicyConfig;

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

  runResolveDashboardActionSharedSuite(buildDeps);
});
