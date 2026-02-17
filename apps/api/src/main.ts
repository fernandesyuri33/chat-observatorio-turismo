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
import { ProviderRouter } from "@conversational/application";
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

// ── Create providers ────────────────────────────────────────────
const lookerProvider = new LookerProvider(policyConfig.looker);
const customProvider = new CustomProvider();

// ── Create router ───────────────────────────────────────────────
const router = new ProviderRouter(
  [lookerProvider, customProvider],
  policyConfig.routing
);

// ── Wire DI container ───────────────────────────────────────────
const di: ResolveDashboardActionDeps = {
  llm,
  policyEngine,
  router,
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
