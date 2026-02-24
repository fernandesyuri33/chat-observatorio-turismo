import OpenAI from "openai";
import Instructor from "@instructor-ai/instructor";
import type { z } from "zod";
import type { LlmPort } from "./llm.port.js";

// ── Default system prompt — tourism dashboard domain ────────────

const INFORMATION_TYPE_BULLETS_TOKEN = "__INFORMATION_TYPE_BULLETS__";
const INFORMATION_TYPE_PLACEHOLDER_TOKEN = "__INFORMATION_TYPE_OPTIONS__";
const CLASSIFICACAO_BULLETS_TOKEN = "__CLASSIFICACAO_BULLETS__";
const CLASSIFICACAO_PLACEHOLDER_TOKEN = "__CLASSIFICACAO_OPTIONS__";

function extractEnumValues(schema: z.ZodTypeAny): string[] {
  const enumValues = (schema as z.ZodTypeAny & { _def?: { values?: readonly string[] } })._def?.values;
  if (enumValues && Array.isArray(enumValues)) {
    return [...enumValues];
  }

  const options = (schema as z.ZodTypeAny & { options?: readonly string[] }).options;
  if (options && Array.isArray(options)) {
    return [...options];
  }

  const innerType = (schema as z.ZodTypeAny & { _def?: { innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny } })._def?.innerType
    ?? (schema as z.ZodTypeAny & { _def?: { innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny } })._def?.schema;

  if (innerType) {
    return extractEnumValues(innerType);
  }

  return [];
}

function extractInformationTypeValues(schema: z.ZodTypeAny): string[] {
  const schemaDef = (schema as z.ZodTypeAny & { _def?: { options?: z.ZodTypeAny[] } })._def;
  const options = schemaDef?.options;

  if (!options || !Array.isArray(options)) {
    return [];
  }

  for (const option of options) {
    const optionDef = option as z.ZodTypeAny & {
      _def?: {
        shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
      };
    };

    const rawShape = optionDef._def?.shape;
    const shape = typeof rawShape === "function" ? rawShape() : rawShape;
    if (!shape) {
      continue;
    }

    const intentDef = shape["intent"] as z.ZodTypeAny & { _def?: { value?: unknown } };
    if (intentDef?._def?.value !== "show") {
      continue;
    }

    const informationTypeSchema = shape["informationType"] as z.ZodTypeAny & {
      options?: readonly string[];
      _def?: { values?: readonly string[] };
    };

    if (informationTypeSchema?._def?.values && Array.isArray(informationTypeSchema._def.values)) {
      return [...informationTypeSchema._def.values];
    }

    if (informationTypeSchema?.options && Array.isArray(informationTypeSchema.options)) {
      return [...informationTypeSchema.options];
    }
  }

  return [];
}

function extractClassificacaoValues(schema: z.ZodTypeAny): string[] {
  const schemaDef = (schema as z.ZodTypeAny & { _def?: { options?: z.ZodTypeAny[] } })._def;
  const options = schemaDef?.options;

  if (!options || !Array.isArray(options)) {
    return [];
  }

  for (const option of options) {
    const optionDef = option as z.ZodTypeAny & {
      _def?: {
        shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
      };
    };

    const rawShape = optionDef._def?.shape;
    const shape = typeof rawShape === "function" ? rawShape() : rawShape;
    if (!shape) {
      continue;
    }

    const filtersSchema = shape["proposedFilters"] as z.ZodTypeAny & {
      _def?: {
        shape?: Record<string, z.ZodTypeAny> | (() => Record<string, z.ZodTypeAny>);
      };
    };

    const rawFiltersShape = filtersSchema?._def?.shape;
    const filtersShape = typeof rawFiltersShape === "function" ? rawFiltersShape() : rawFiltersShape;
    if (!filtersShape) {
      continue;
    }

    const classificacaoSchema = filtersShape["classificacao"] as z.ZodTypeAny;
    if (!classificacaoSchema) {
      continue;
    }

    const values = extractEnumValues(classificacaoSchema);
    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function buildPromptFromSchema(template: string, schema: z.ZodTypeAny): string {
  const informationTypes = extractInformationTypeValues(schema);
  const classificacoes = extractClassificacaoValues(schema);

  const informationTypeBullets = (informationTypes.length > 0 ? informationTypes : ["definido_no_schema"])
    .map((informationType) => `- "${informationType}"`)
    .join("\n");

  const classificacaoBullets = (classificacoes.length > 0 ? classificacoes : ["definido_no_schema"])
    .map((classificacao) => `- "${classificacao}"`)
    .join("\n");

  const informationTypeOptions = informationTypes.length > 0
    ? informationTypes.join("|")
    : "definido_no_schema";

  const classificacaoOptions = classificacoes.length > 0
    ? classificacoes.join("|")
    : "definido_no_schema";

  return template
    .replace(INFORMATION_TYPE_BULLETS_TOKEN, informationTypeBullets)
    .replace(INFORMATION_TYPE_PLACEHOLDER_TOKEN, informationTypeOptions)
    .replace(CLASSIFICACAO_BULLETS_TOKEN, classificacaoBullets)
    .replace(CLASSIFICACAO_PLACEHOLDER_TOKEN, classificacaoOptions);
}

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de um dashboard de turismo.
Sua tarefa é interpretar a mensagem do usuário e devolver um objeto JSON estruturado que represente a intenção dele.

Intenções possíveis:
- "show"     → o usuário quer visualizar uma informação no dashboard
- "help"     → não foi possível determinar com segurança o que mostrar
- "initial_orientation" → o usuário pediu orientação aberta sobre o que pode analisar no dashboard

Tipos de informação disponíveis (páginas):
${INFORMATION_TYPE_BULLETS_TOKEN}

Filtros disponíveis:
- classificacao (valores permitidos):
${CLASSIFICACAO_BULLETS_TOKEN}
- municipio: string

Responda **somente** com JSON válido no seguinte formato:
{
  "intent": "<show|help|initial_orientation>",
  "informationType": "<${INFORMATION_TYPE_PLACEHOLDER_TOKEN}>",
  "proposedFilters": {
    "classificacao"?: "<${CLASSIFICACAO_PLACEHOLDER_TOKEN}>",
    "municipio"?: string
  },
  "confidence": <número de 0 a 1>,
  "rationale": "<breve justificativa da interpretação>"
}

Regras:
- Para intent "show", "informationType" é obrigatório.
- Para "help" e "initial_orientation", omita "informationType".
- Nunca envie "informationType": null.
- "proposedFilters" deve conter apenas os filtros explicitamente mencionados.
- "confidence" deve refletir quão claro e específico foi o pedido.
- Se o usuário não mencionou nenhum filtro, retorne proposedFilters vazio ({}).
- Se a mensagem é vaga, use confidence baixa (< 0.5) e rationale explicando a dúvida.
- Se for pedido de ajuda, intent = "help" e proposedFilters = {}.
- Se o usuário perguntar de forma aberta sobre o que pode analisar (ex.: "que dados posso obter aqui?", "o que posso descobrir aqui?"), use intent = "initial_orientation" e proposedFilters = {}.
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
          { role: "system", content: buildPromptFromSchema(this.systemPrompt, schema) },
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
