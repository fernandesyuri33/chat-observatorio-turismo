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

  runResolveDashboardActionSharedSuite(buildDeps);
});
