import OpenAI from "openai";
import type { LlmPort, ConversationTurn, StructuredSchema } from "./llm.port.js";
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
  /** Timeout máximo por tentativa em ms (padrão e máximo: 8000) */
  requestTimeoutMs?: number;
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
  private readonly requestTimeoutMs: number;

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
    const configuredTimeoutMs = config.requestTimeoutMs ?? 8000;
    this.requestTimeoutMs = Math.min(Math.max(configuredTimeoutMs, 1), 8000);

    this.client = new OpenAI({ baseURL, apiKey });

    logLlmInit({
      baseURL,
      model: this.model,
    });
  }

  async generateStructured<T>(
    schema: StructuredSchema<T>,
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
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, this.requestTimeoutMs);

      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          temperature: this.temperature,
          response_format: { type: "json_object" },
          messages,
        }, {
          signal: abortController.signal,
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
        if (abortController.signal.aborted) {
          lastError = new Error(
            `LLM request timed out after ${this.requestTimeoutMs}ms (attempt ${attempt}/${this.maxRetries})`,
            { cause: error },
          );
        } else {
          lastError = error;
        }

        if (raw) {
          logLlmParseError(attempt, this.maxRetries, raw, lastError);
        } else {
          logLlmRequestError(attempt, this.maxRetries, lastError);
        }
        logLlmRetry(attempt, this.maxRetries, lastError);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    logLlmFailure(Date.now() - startedAt, lastError);
    throw lastError;
  }
}
