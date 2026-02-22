import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { dashboardRoutes } from "./dashboard.js";
import type { ResolveDashboardActionDeps } from "@conversational/application";
import { PolicyEngine, type PolicyConfig } from "@conversational/policy";
import { StubLlmAdapter } from "@conversational/llm";
import { LookerProvider } from "@conversational/providers";

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

describe("POST /dashboard/resolve", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();

    const deps: ResolveDashboardActionDeps = {
      llm: new StubLlmAdapter(),
      policyEngine: new PolicyEngine(testPolicyConfig),
      provider: new LookerProvider(testPolicyConfig.looker),
    };

    app.decorate("di", deps);
    await app.register(dashboardRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns initial orientation guidance for open questions", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/dashboard/resolve",
      payload: {
        message: "O que posso analisar ou descobrir aqui?",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.action.type).toBe("explain_only");
    expect(body.action.message).toContain("caminhos de exploração");
    expect(body.action.suggestions).toEqual([
      "Comparar estabelecimentos entre municípios",
      "Visualizar a quantidade de funcionários por município",
      "Acompanhar a evolução de funcionários ao longo do tempo",
    ]);
  });

  it("returns 400 for invalid request payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/dashboard/resolve",
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.error).toBe("Requisição inválida");
  });
});
