import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { rotas } from "./rotas.js";
import type { ResolveDashboardActionDeps } from "@conversational/application";
import { PolicyEngine, type PolicyConfig } from "@conversational/policy";
import { StubLlmAdapter, type ConversationTurn } from "@conversational/llm";
import { LookerProvider } from "@conversational/providers";

function parseUrlAndParams(urlString: string): {
  url: URL;
  params: Record<string, unknown> | null;
} {
  const url = new URL(urlString);
  const rawParams = url.searchParams.get("params");

  return {
    url,
    params: rawParams ? JSON.parse(rawParams) as Record<string, unknown> : null,
  };
}

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
  history: {
    maxMessages: 3,
    ttlSeconds: 1800,
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
    baseUrl: "https://datastudio.google.com/embed/reporting/abc123/page/p_1",
    paramMap: {},
    paramMapByInformationType: {
      estabelecimentos_por_municipio: {
        municipio: "ds19.p_municipio",
        classificacao: "ds19.p_classificacao",
      },
      funcionarios_por_municipio: {
        municipio: "ds17.p_municipio",
        classificacao: "ds17.p_classificacao",
      },
      funcionarios_ao_longo_do_tempo: {
        municipio: "ds18.p_municipio",
        classificacao: "ds18.p_classificacao",
      },
      saldo_funcionarios_ao_longo_do_tempo: {
        municipio: "ds20.p_municipio",
        classificacao: "ds20.p_classificacao",
      },
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
  const historyStore = new Map<string, ConversationTurn[]>();

  beforeEach(async () => {
    app = Fastify();
    historyStore.clear();

    const deps: ResolveDashboardActionDeps = {
      llm: new StubLlmAdapter(),
      policyEngine: new PolicyEngine(testPolicyConfig),
      provider: new LookerProvider(testPolicyConfig.looker),
    };

    app.decorate("di", deps);
    app.decorate("historyService", {
      async get(conversationId: string) {
        return historyStore.get(conversationId) ?? [];
      },
      async append(conversationId: string, newTurns: ConversationTurn[]) {
        const existing = historyStore.get(conversationId) ?? [];
        const merged = [...existing, ...newTurns].slice(-testPolicyConfig.history.maxMessages);
        historyStore.set(conversationId, merged);
      },
    });
    await app.register(rotas);
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
    expect(body.action.message).toBeTruthy();
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
    expect(body.action.message).toBeTruthy();
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
    expect(body.action.message).toBeTruthy();
    expect(body.action.suggestions).toEqual([
      "Visualizar a quantidade de funcionários ao longo do tempo",
    ]);
  });

  it("retorna open_url com params do Looker mapeados por recorte", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/mensagem",
      payload: {
        message: "Mostre funcionários por município em Poços de Caldas",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.action.type).toBe("open_url");

    if (body.action.type === "open_url") {
      const { url, params } = parseUrlAndParams(body.action.url);
      expect(url.pathname).toContain("/page/p_funcionarios_municipio");
      expect(params).toEqual({
        "ds17.p_municipio": "Poços de Caldas",
      });
    }
  });

  it("usa e persiste histórico quando recebe x-conversation-id", async () => {
    const conversationId = "conv-teste-1";
    historyStore.set(conversationId, [
      { role: "user", content: "Mostre funcionários por município" },
      {
        role: "assistant",
        content: JSON.stringify({ type: "open_url", url: "https://example.com" }),
      },
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/mensagem",
      headers: {
        "x-conversation-id": conversationId,
      },
      payload: {
        message: "Poços de Caldas",
      },
    });

    expect(response.statusCode).toBe(200);

    const stored = historyStore.get(conversationId);
    expect(stored).toBeDefined();
    expect(stored?.length).toBe(testPolicyConfig.history.maxMessages);
    expect(stored?.at(-2)).toEqual({ role: "user", content: "Poços de Caldas" });
    expect(stored?.at(-1)?.role).toBe("assistant");

    const assistantContent = stored?.at(-1)?.content;
    expect(assistantContent).toBeDefined();

    expect(assistantContent).toContain("contexto");
    expect(assistantContent).not.toContain("{");
  });
});
