import OpenAI from "openai";
import Instructor from "@instructor-ai/instructor";
import type { z } from "zod";
import type { LlmPort } from "./llm.port.js";

// ── Default system prompt — tourism dashboard domain ────────────

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de um dashboard de turismo.
Sua tarefa é interpretar a mensagem do usuário e devolver um objeto JSON estruturado que represente a intenção dele.

Intenções possíveis:
- "filter"   → o usuário quer aplicar ou alterar filtros (cidade, ano, mês, indicador)
- "compare"  → o usuário quer comparar métricas entre períodos ou cidades
- "trend"    → o usuário quer ver a evolução/tendência de uma métrica ao longo do tempo
- "topN"     → o usuário quer um ranking (ex.: "top 5 cidades")
- "help"     → o usuário pediu ajuda ou fez pergunta sobre o sistema

Métricas conhecidas: visitas, ocupacao, eventos.
Dimensões conhecidas: cidade, ano, mes, indicador.
Anos permitidos: 2018–2026. Meses permitidos: 1–12.

Responda **somente** com JSON válido no seguinte formato:
{
  "intent": "<filter|compare|trend|topN|help>",
  "proposedFilters": { "cidade"?: string, "ano"?: number[], "mes"?: number[], "indicador"?: string },
  "entities": { <entidades extraídas da mensagem> },
  "confidence": <número de 0 a 1>,
  "rationale": "<breve justificativa da interpretação>"
}

Regras:
- "proposedFilters" deve conter apenas os filtros explicitamente mencionados.
- "confidence" deve refletir quão claro e específico foi o pedido.
- Se o usuário não mencionou nenhum filtro, retorne proposedFilters vazio ({}).
- Se a mensagem é vaga, use confidence baixa (< 0.5) e rationale explicando a dúvida.
- Se for pedido de ajuda, intent = "help", proposedFilters = {}, entities = {}.
- Sempre responda em português.`;

// ── Config ──────────────────────────────────────────────────────

export interface OllamaLlmAdapterConfig {
  /** Ollama base URL (default: env OLLAMA_BASE_URL or http://localhost:11434/v1) */
  baseURL?: string;
  /** Model identifier (default: env OLLAMA_MODEL or llama3.1:8b) */
  model?: string;
  /** API key (default: env OLLAMA_API_KEY or "ollama") */
  apiKey?: string;
  /** Override the default system prompt */
  systemPrompt?: string;
  /** Sampling temperature (default: 0) */
  temperature?: number;
  /** Max retries on transient failures (default: 2) */
  maxRetries?: number;
}

// ── Adapter ─────────────────────────────────────────────────────

export class OllamaLlmAdapter implements LlmPort {
  private readonly instructor: ReturnType<typeof Instructor>;
  private readonly model: string;
  private readonly systemPrompt: string;
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
    this.maxRetries = config.maxRetries ?? 2;
    this.systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    const client = new OpenAI({ baseURL, apiKey });
    this.instructor = Instructor({ client, mode: "JSON" });

    console.info("[ollama] adapter initialized", {
      baseURL,
      model: this.model,
    });
  }

  async generateStructured<T>(schema: z.ZodType<T>, input: string): Promise<T> {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();

    console.info("[ollama] request:start", {
      requestId,
      model: this.model,
      input,
    });

    try {
      const result = await this.instructor.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        max_retries: this.maxRetries,
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: input },
        ],
        response_model: {
          schema: schema as unknown as z.AnyZodObject,
          name: "StructuredOutput",
        },
      });

      console.info("[ollama] request:done", {
        requestId,
        durationMs: Date.now() - startedAt,
        result: JSON.stringify(result),
      });

      // Instructor returns the parsed & validated object directly
      return result as T;
    } catch (error) {
      console.error("[ollama] request:error", {
        requestId,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  }
}
