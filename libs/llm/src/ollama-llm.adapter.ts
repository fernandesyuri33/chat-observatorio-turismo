import OpenAI from "openai";
import Instructor from "@instructor-ai/instructor";
import type { z } from "zod";
import type { LlmPort, ConversationTurn } from "./llm.port.js";

// ── Configuração ────────────────────────────────────────────────

export interface OllamaLlmAdapterConfig {
  /** URL base do Ollama (padrão: env OLLAMA_BASE_URL ou http://localhost:11434/v1) */
  baseURL?: string;
  /** Identificador do modelo (padrão: env OLLAMA_MODEL ou llama3.1:8b) */
  model?: string;
  /** Chave de API (padrão: env OLLAMA_API_KEY ou "ollama") */
  apiKey?: string;
  /** Temperatura de amostragem (padrão: 0) */
  temperature?: number;
  /** Máximo de tentativas em falhas transitórias (padrão: 3) */
  maxRetries?: number;
}

// ── Adaptador ───────────────────────────────────────────────────

export class OllamaLlmAdapter implements LlmPort {
  private readonly instructor: ReturnType<typeof Instructor>;
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
      "llama3.1:8b";

    const apiKey =
      config.apiKey ??
      process.env["OLLAMA_API_KEY"] ??
      "ollama";

    this.temperature = config.temperature ?? 0;
    this.maxRetries = config.maxRetries ?? 3;

    const client = new OpenAI({ baseURL, apiKey });
    this.instructor = Instructor({ client, mode: "JSON" });

    console.info("[ollama] adapter initialized", {
      baseURL,
      model: this.model,
    });
  }

  async generateStructured<T>(
    schema: z.ZodType<T>,
    input: string,
    systemPrompt: string,
    history?: ConversationTurn[],
  ): Promise<T> {
    const startedAt = Date.now();

    console.info("Enviando mensagem para o LLM", {
      modelo: this.model,
      mensagem: input,
      mensagensNoHistorico: history?.length ?? 0,
    });

    const historyMessages: { role: "user" | "assistant"; content: string }[] =
      history?.map((turn) => ({ role: turn.role, content: turn.content })) ?? [];

    try {
      const result = await this.instructor.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        max_retries: this.maxRetries,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...historyMessages,
          { role: "user", content: input },
        ],
        response_model: {
          schema: schema as unknown as z.AnyZodObject,
          name: "StructuredOutput",
        },

      });

      console.info("Resposta recebida da LLM", {
        duracaoEmMs: Date.now() - startedAt,
        resultado: JSON.stringify(result),
      });

      // Instructor retorna diretamente o objeto parseado e validado
      return result as T;
    } catch (error) {
      console.error("Erro ao enviar mensagem para o LLM", {
        duracaoEmMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  }
}
