import OpenAI from "openai";
import { z } from "zod";
import type { LlmPort, ConversationTurn } from "./llm.port.js";
import {
  logLlmInit,
  logLlmRequest,
  logLlmResponse,
  logLlmRetry,
  logLlmParseError,
  logLlmRequestError,
  logLlmFailure,
} from "./llm-logger.js";

// ── Configuração ────────────────────────────────────────────────

export interface OllamaLlmAdapterConfig {
  /** URL base do Ollama (padrão: env OLLAMA_BASE_URL ou http://localhost:11434/v1) */
  baseURL?: string;
  /** Identificador do modelo (padrão: env OLLAMA_MODEL ou gemma3:4b) */
  model?: string;
  /** Chave de API (padrão: env OLLAMA_API_KEY ou "ollama") */
  apiKey?: string;
  /** Temperatura de amostragem (padrão: 0) */
  temperature?: number;
  /** Máximo de tentativas em falhas transitórias (padrão: 3) */
  maxRetries?: number;
}

// ── Normalização de aliases de campo ────────────────────────────
// LLMs às vezes retornam "rational" ao invés de "rationale".
// Normalizamos antes do parse Zod para não perder o campo.
const LLM_FIELD_ALIASES: Record<string, string> = {
  rational: "rationale",
};

function normalizeLlmFieldAliases(obj: Record<string, unknown>): void {
  for (const [alias, canonical] of Object.entries(LLM_FIELD_ALIASES)) {
    if (alias in obj && !(canonical in obj)) {
      obj[canonical] = obj[alias];
      delete obj[alias];
    }
  }
}

// ── Adaptador ───────────────────────────────────────────────────

export class OllamaLlmAdapter implements LlmPort {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxRetries: number;

  constructor(config: OllamaLlmAdapterConfig = {}) {
    const baseURL =
      config.baseURL ??
      process.env["OLLAMA_BASE_URL"] ??
      "http://localhost:11434/v1";

    this.model =
      config.model ??
      process.env["OLLAMA_MODEL"] ??
      "gemma3:4b";

    const apiKey =
      config.apiKey ??
      process.env["OLLAMA_API_KEY"] ??
      "ollama";

    this.temperature = config.temperature ?? 0;
    this.maxRetries = config.maxRetries ?? 3;

    this.client = new OpenAI({ baseURL, apiKey });

    logLlmInit({
      baseURL,
      model: this.model,
    });
  }

  async generateStructured<T>(
    schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    input: string,
    systemPrompt: string,
    history?: ConversationTurn[],
  ): Promise<T> {
    const startedAt = Date.now();

    logLlmRequest({
      modelo: this.model,
      mensagem: input,
      histórico: `${history?.length ?? 0} turnos`,
    });

    const historyMessages: { role: "user" | "assistant"; content: string }[] =
      history?.map((turn) => ({ role: turn.role, content: turn.content })) ?? [];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: input },
    ];

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      let raw = "";
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          temperature: this.temperature,
          response_format: { type: "json_object" },
          messages,
        });

        raw = completion.choices[0]?.message?.content ?? "";
        const jsonObj = JSON.parse(raw) as Record<string, unknown>;
        normalizeLlmFieldAliases(jsonObj);
        const parsed = schema.parse(jsonObj);

        logLlmResponse({
          duraçãoMs: `${Date.now() - startedAt}ms`,
          tentativa: attempt,
          resultado: raw,
        });

        return parsed;
      } catch (error) {
        lastError = error;
        if (raw) {
          logLlmParseError(attempt, this.maxRetries, raw, error);
        } else {
          logLlmRequestError(attempt, this.maxRetries, error);
        }
        logLlmRetry(attempt, this.maxRetries, error);
      }
    }

    logLlmFailure(Date.now() - startedAt, lastError);
    throw lastError;
  }
}
