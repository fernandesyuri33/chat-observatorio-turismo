import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { dashboardRoutes } from "./dashboard.js";
import type { ResolveDashboardActionDeps } from "@conversational/application";
import { PolicyEngine, type PolicyConfig } from "@conversational/policy";
import { StubLlmAdapter } from "@conversational/llm";
import { LookerProvider } from "@conversational/providers";

const testPolicyConfig: PolicyConfig = {
  minConfidence: 0.5,
  synonyms: {
    "funcionários por município": "funcionarios_por_municipio",
  },
  activeProvider: "looker",
  fallback: {
    retryCount: 1,
    contextualOrientationOptionCount: 3,
  },
  curiosityFaq: [
    {
      questionExamples: [
        "O setor turístico de Poços de Caldas está evoluindo?",
      ],
      response:
        "Uma forma de explorar essa questão é visualizar a evolução da quantidade de funcionários ao longo do tempo. Deseja ajustar o dashboard para esse recorte?",
      suggestion: "Visualizar a quantidade de funcionários ao longo do tempo",
      informationType: "funcionarios_ao_longo_do_tempo",
    },
  ],
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

describe("POST /mensagem", () => {
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

  it("retorna orientação inicial para perguntas abertas", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/mensagem",
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

  it("retorna 400 para payload de requisição inválido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/mensagem",
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    const body = response.json();
    expect(body.error).toBe("Requisição inválida");
  });

  it("retorna orientação contextual para perguntas semi formuladas", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/mensagem",
      payload: {
        message: "Quero ver dados de Poços de Caldas",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.action.type).toBe("explain_only");
    expect(body.action.message).toContain("A partir desse recorte, você pode explorar");
    expect(body.action.suggestions).toEqual([
      "Quantidade de funcionários ao longo do tempo",
      "Saldo de funcionários ao longo do tempo",
      "Quantidade de funcionários por município",
    ]);
  });

  it("retorna resposta de curiosidade baseada em FAQ configurado", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/mensagem",
      payload: {
        message: "O setor turístico de Poços de Caldas está evoluindo?",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.action.type).toBe("explain_only");
    expect(body.action.message).toContain(
      "Uma forma de explorar essa questão é visualizar a evolução da quantidade de funcionários ao longo do tempo"
    );
    expect(body.action.suggestions).toEqual([
      "Visualizar a quantidade de funcionários ao longo do tempo",
    ]);
  });
});
