import { describe, it, expect } from "vitest";
import { PolicyEngine } from "@conversational/policy";
import { OllamaLlmAdapter } from "@conversational/llm";
import { LookerProvider, CustomProvider } from "@conversational/providers";
import type { PolicyConfig } from "@conversational/policy";
import {
  baseTestPolicyConfig,
  runResolveDashboardActionSharedSuite,
} from "./resolve-dashboard-action.shared";

const runRealLlmTests = process.env["RUN_REAL_LLM_TESTS"] === "true";
const describeRealLlm = runRealLlmTests ? describe : describe.skip;

const testPolicyConfig: PolicyConfig = baseTestPolicyConfig;

describeRealLlm("resolveDashboardAction (real llm)", () => {
  function buildDeps(overrideConfig?: Partial<PolicyConfig>) {
    const config = { ...testPolicyConfig, ...overrideConfig };
    const policyEngine = new PolicyEngine(config);
    const llm = new OllamaLlmAdapter();
    const provider = config.activeProvider === "custom"
      ? new CustomProvider()
      : new LookerProvider(config.looker);
    return { llm, policyEngine, provider };
  }

  runResolveDashboardActionSharedSuite(buildDeps, { testTimeout: 45_000 });
});
