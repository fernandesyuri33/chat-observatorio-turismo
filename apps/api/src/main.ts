import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";

import { PolicyEngine } from "@conversational/policy";
import { OllamaLlmAdapter, StubLlmAdapter } from "@conversational/llm";
import type { LlmPort } from "@conversational/llm";
import { LookerProvider, CustomProvider } from "@conversational/providers";
import type { ActionProvider } from "@conversational/providers";
import type { ResolveDashboardActionDeps } from "@conversational/application";

import { dashboardRoutes } from "./routes/dashboard.js";
import { policyConfig } from "../config/policy.js";

// ── Inicialização ───────────────────────────────────────────────

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// ── Carrega configuração de política ────────────────────────────
const policyEngine = new PolicyEngine(policyConfig);

// ── Cria adaptador de LLM ───────────────────────────────────────
// Use LLM_ADAPTER=stub para forçar o stub (teste unitário / dev offline).
// Caso contrário, o adaptador real do Ollama é utilizado.
const llm: LlmPort =
  process.env["LLM_ADAPTER"] === "stub"
    ? new StubLlmAdapter()
    : new OllamaLlmAdapter();

// ── Cria registro de providers ──────────────────────────────────
// Todos os providers conhecidos são registrados aqui. Apenas o identificado
// por `activeProvider` em config/policy.ts é utilizado em tempo de execução.
const providerRegistry = new Map<string, ActionProvider>([
  ["looker", new LookerProvider(policyConfig.looker)],
  ["custom", new CustomProvider()],
]);

// ── Seleciona provider ativo pela configuração ──────────────────
const activeProvider = providerRegistry.get(policyConfig.activeProvider);
if (!activeProvider) {
  throw new Error(
    `activeProvider desconhecido "${policyConfig.activeProvider}". ` +
    `Disponíveis: ${[...providerRegistry.keys()].join(", ")}`
  );
}

// ── Faz o wiring do container de DI ─────────────────────────────
const di: ResolveDashboardActionDeps = {
  llm,
  policyEngine,
  provider: activeProvider,
};

app.decorate("di", di);

// ── Health check  -------------------------──────────────────────
app.get("/health", async () => ({ status: "ok" }));

// ── Registra rotas de domínio ───────────────────────────────────
await app.register(dashboardRoutes);

// ── Inicia servidor ─────────────────────────────────────────────
const port = Number(process.env["PORT"] ?? 3001);
const host = process.env["HOST"] ?? "0.0.0.0";

app.listen({ port, host });
