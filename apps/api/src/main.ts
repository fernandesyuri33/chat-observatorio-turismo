import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";

import { PolicyEngine, loadPolicyConfig } from "@conversational/policy";
import { OllamaLlmAdapter, StubLlmAdapter } from "@conversational/llm";
import type { LlmPort } from "@conversational/llm";
import { LookerProvider, CustomProvider } from "@conversational/providers";
import type { ActionProvider } from "@conversational/providers";
import type { ResolveDashboardActionDeps } from "@conversational/application";

import { dashboardRoutes } from "./routes/dashboard.js";

// ── Bootstrap ───────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// ── Load policy config ──────────────────────────────────────────
const policyPath = resolve(__dirname, "..", "config", "policy.json");
const policyConfig = loadPolicyConfig(policyPath);
const policyEngine = new PolicyEngine(policyConfig);

// ── Create LLM adapter ─────────────────────────────────────────
// Use LLM_ADAPTER=stub to force the stub (unit-test / offline dev).
// Otherwise the real Ollama adapter is used.
const llm: LlmPort =
  process.env["LLM_ADAPTER"] === "stub"
    ? new StubLlmAdapter()
    : new OllamaLlmAdapter();

// ── Create providers registry ───────────────────────────────────
// All known providers are registered here. Only the one identified
// by `activeProvider` in policy.json is used at runtime.
const providerRegistry = new Map<string, ActionProvider>([
  ["looker", new LookerProvider(policyConfig.looker)],
  ["custom", new CustomProvider()],
]);

// ── Select active provider from config ──────────────────────────
const activeProvider = providerRegistry.get(policyConfig.activeProvider);
if (!activeProvider) {
  throw new Error(
    `Unknown activeProvider "${policyConfig.activeProvider}". ` +
    `Available: ${[...providerRegistry.keys()].join(", ")}`
  );
}

// ── Wire DI container ───────────────────────────────────────────
const di: ResolveDashboardActionDeps = {
  llm,
  policyEngine,
  provider: activeProvider,
};

app.decorate("di", di);

// ── Health check (preserved from prototype) ─────────────────────
app.get("/health", async () => ({ status: "ok" }));

// ── Register domain routes ──────────────────────────────────────
await app.register(dashboardRoutes);

// ── Start server ────────────────────────────────────────────────
const port = Number(process.env["PORT"] ?? 3001);
const host = process.env["HOST"] ?? "0.0.0.0";

app.listen({ port, host });
