import OpenAI from "openai";
import Instructor from "@instructor-ai/instructor";
import {
  ActionSchema,
  type Action,
  type Filters,
  CITY_LIST,
  INDICATORS
} from "@conversational/contracts";

const baseURL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1";
const model = process.env["OLLAMA_MODEL"] ?? "llama3.1:8b";
const apiKey = process.env["OLLAMA_API_KEY"] ?? "ollama";

const client = new OpenAI({ baseURL, apiKey });
const instructor = Instructor({ client, mode: "JSON" });

const systemPrompt = `Voce e um assistente que decide uma acao estruturada para um dashboard.
Aja somente dentro do mundo fechado.

Acoes possiveis:
- set_filters { cidade?: string; ano?: number[]; mes?: number[]; indicador?: 'visitas'|'ocupacao'|'eventos' }
- reset_filters {}
- describe_metric { indicador: 'visitas'|'ocupacao'|'eventos' }
- unknown { reason: string; suggestions: string[] }

Cidades validas: ${CITY_LIST.join(", ")}.
Indicadores validos: ${INDICATORS.join(", ")}.
Ano permitido: 2018-2026. Mes permitido: 1-12.

Responda somente com JSON valido conforme o schema:
{ "type": "set_filters", "filters": { "cidade"?: string, "ano"?: number[], "mes"?: number[], "indicador"?: string } }
{ "type": "reset_filters" }
{ "type": "describe_metric", "indicador": "visitas"|"ocupacao"|"eventos" }
{ "type": "unknown", "reason": string, "suggestions": string[] }.`;

function normalizeFilters(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const filters = { ...(input as Record<string, unknown>) };

  if (filters["mes"] === null || (Array.isArray(filters["mes"]) && filters["mes"].length === 0)) {
    delete filters["mes"];
  }
  if (filters["ano"] === null || (Array.isArray(filters["ano"]) && filters["ano"].length === 0)) {
    delete filters["ano"];
  }
  if (filters["cidade"] === null) {
    delete filters["cidade"];
  }
  if (filters["indicador"] === null) {
    delete filters["indicador"];
  }

  return filters;
}

function parseActionFromResponse(response: unknown): Action | null {
  const content = (response as { choices?: { message?: { content?: string } }[] })
    ?.choices?.[0]?.message?.content;

  if (!content) return null;

  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return null;
  }

  if (!json || typeof json !== "object") return null;

  const payload = json as Record<string, unknown>;
  let candidate: unknown = payload;

  if (!("type" in payload)) {
    if ("set_filters" in payload) {
      candidate = { type: "set_filters", filters: normalizeFilters(payload["set_filters"]) };
    } else if ("reset_filters" in payload) {
      candidate = { type: "reset_filters" };
    } else if ("describe_metric" in payload) {
      const value = payload["describe_metric"] as Record<string, unknown> | string | undefined;
      candidate = {
        type: "describe_metric",
        indicador: typeof value === "string" ? value : value?.["indicador"]
      };
    } else if ("unknown" in payload) {
      candidate = { type: "unknown", ...(payload["unknown"] as object) };
    }
  }

  if (
    candidate &&
    typeof candidate === "object" &&
    "type" in (candidate as Record<string, unknown>) &&
    (candidate as Record<string, unknown>)["type"] === "set_filters"
  ) {
    const asRecord = candidate as Record<string, unknown>;
    candidate = { ...asRecord, filters: normalizeFilters(asRecord["filters"]) };
  }

  const parsed = ActionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function buildAssistantText(action: Action): string | undefined {
  switch (action.type) {
    case "set_filters": {
      const parts: string[] = [];
      if (action.filters.cidade) parts.push(`cidade ${action.filters.cidade}`);
      if (action.filters.ano?.length) parts.push(`ano ${action.filters.ano.join(", ")}`);
      if (action.filters.mes?.length) parts.push(`mes ${action.filters.mes.join(", ")}`);
      if (action.filters.indicador) parts.push(`indicador ${action.filters.indicador}`);
      return parts.length ? `Aplicando filtros: ${parts.join(" | ")}.` : "Filtros atualizados.";
    }
    case "reset_filters":
      return "Filtros resetados.";
    case "describe_metric":
      return `O indicador ${action.indicador} representa a metrica selecionada no dashboard.`;
    case "unknown":
      return action.reason;
  }
}

export async function interpretMessage(message: string, currentFilters: Filters) {
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  try {
    console.info("[ollama] request:start", {
      requestId,
      baseURL,
      model,
      message,
      currentFilters
    });

    const response = await instructor.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Mensagem: ${message}\nFiltros atuais: ${JSON.stringify(currentFilters)}`
        }
      ],
      // response_model: {
      //   schema: ActionSchema,
      //   name: "Action"
      // }
    });

    console.info("[ollama] request:done", {
      requestId,
      durationMs: Date.now() - startedAt,
      response: JSON.stringify(response)
    });

    const action =
      parseActionFromResponse(response) ??
      ({
        type: "unknown",
        reason: "Nao consegui interpretar a solicitacao dentro do mundo fechado.",
        suggestions: [
          "Quero visitas em Sao Paulo em 2024",
          "Resetar filtros",
          "Explique o indicador ocupacao"
        ]
      } satisfies Action);

    return {
      action,
      assistantText: buildAssistantText(action)
    };
  } catch (error) {
    console.error("[ollama] request:error", {
      requestId,
      durationMs: Date.now() - startedAt,
      error
    });
    const action: Action = {
      type: "unknown",
      reason: "O modelo local nao respondeu. Verifique se o Ollama esta ativo.",
      suggestions: [
        "Quero visitas em Sao Paulo em 2024",
        "Resetar filtros",
        "Explique o indicador ocupacao"
      ]
    };

    return {
      action,
      assistantText: buildAssistantText(action)
    };
  }
}
