import chalk from "chalk";

// ── Layout constants ────────────────────────────────────────────
const BOX_WIDTH = 58;
const REQ_BORDER = chalk.magenta;
const REQ_TITLE = chalk.magentaBright.bold;
const RES_BORDER = chalk.blue;
const RES_TITLE = chalk.blueBright.bold;
const WARN_COLOR = chalk.yellow.bold;
const ERROR_COLOR = chalk.red.bold;
const KEY_COLOR = chalk.dim;
const VALUE_COLOR = chalk.white;
const ARROW = chalk.yellow("→");

function printBox(
  title: string,
  borderColor: typeof REQ_BORDER,
  titleColor: typeof REQ_TITLE,
  fields?: Record<string, unknown>,
): void {
  const top = borderColor("┌" + "─".repeat(BOX_WIDTH) + "┐");
  const bottom = borderColor("└" + "─".repeat(BOX_WIDTH) + "┘");
  const padded = ` ${title}`;
  const padding = " ".repeat(Math.max(0, BOX_WIDTH - padded.length - 1));
  console.log(top);
  console.log(borderColor("│") + titleColor(padded) + padding + borderColor("│"));
  console.log(bottom);

  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      const keyStr = KEY_COLOR(k.padEnd(14));
      const valStr = VALUE_COLOR(formatValue(v));
      console.log(`  ${keyStr}: ${valStr}`);
    }
    console.log();
  }
}

function formatValue(v: unknown): string {
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isModelNotFoundError(error: unknown): boolean {
  const message = formatError(error).toLowerCase();
  return message.includes("model") && message.includes("not found");
}

// ── Public API ──────────────────────────────────────────────────

/** Box de inicialização do adaptador. */
export function logLlmInit(fields: Record<string, unknown>): void {
  printBox("LLM — Adaptador inicializado", REQ_BORDER, REQ_TITLE, fields);
}

/** Box de envio de requisição ao LLM. */
export function logLlmRequest(fields: Record<string, unknown>): void {
  printBox("LLM — Enviando requisição", REQ_BORDER, REQ_TITLE, fields);
}

/** Box de resposta recebida do LLM. */
export function logLlmResponse(fields: Record<string, unknown>): void {
  printBox("LLM — Resposta recebida", RES_BORDER, RES_TITLE, fields);
}

/** Aviso de tentativa falha (retry). */
export function logLlmRetry(attempt: number, max: number, error: unknown): void {
  console.log(
    WARN_COLOR(`⚠  [llm] tentativa ${attempt}/${max} falhou`) +
      "  " +
      ARROW +
      "  " +
      chalk.yellow(formatError(error)),
  );
  if (isModelNotFoundError(error)) {
    console.log(
      `  ${KEY_COLOR("dica".padEnd(14))}: ${chalk.yellow(
        "configure OLLAMA_MODEL para um modelo existente localmente ou execute: ollama pull <modelo>",
      )}`,
    );
  }
  console.log();
}

/** Falha de requisição ao modelo (ex.: 404 model not found), sem conteúdo JSON para parsear. */
export function logLlmRequestError(attempt: number, max: number, error: unknown): void {
  const REQUEST_BORDER = chalk.red;
  const REQUEST_TITLE = chalk.redBright.bold;
  const top = REQUEST_BORDER("┌" + "─".repeat(BOX_WIDTH) + "┐");
  const bottom = REQUEST_BORDER("└" + "─".repeat(BOX_WIDTH) + "┘");
  const title = ` LLM — Falha na requisição (tentativa ${attempt}/${max})`;
  const padding = " ".repeat(Math.max(0, BOX_WIDTH - title.length - 1));

  console.log(top);
  console.log(REQUEST_BORDER("│") + REQUEST_TITLE(title) + padding + REQUEST_BORDER("│"));
  console.log(bottom);
  console.log(`  ${KEY_COLOR("erro".padEnd(14))}: ${chalk.red(formatError(error))}`);
  if (isModelNotFoundError(error)) {
    console.log(
      `  ${KEY_COLOR("dica".padEnd(14))}: ${chalk.yellow(
        "modelo não encontrado no Ollama local; ajuste OLLAMA_MODEL ou faça pull do modelo esperado",
      )}`,
    );
  }
  console.log();
}

/** Falha de parse/validação — exibe o conteúdo bruto que não pôde ser parseado. */
export function logLlmParseError(attempt: number, max: number, raw: string, error: unknown): void {
  const PARSE_BORDER = chalk.red;
  const PARSE_TITLE = chalk.redBright.bold;
  const top = PARSE_BORDER("┌" + "─".repeat(BOX_WIDTH) + "┐");
  const bottom = PARSE_BORDER("└" + "─".repeat(BOX_WIDTH) + "┘");
  const title = ` LLM — Falha de parse (tentativa ${attempt}/${max})`;
  const padding = " ".repeat(Math.max(0, BOX_WIDTH - title.length - 1));
  console.log(top);
  console.log(PARSE_BORDER("│") + PARSE_TITLE(title) + padding + PARSE_BORDER("│"));
  console.log(bottom);
  console.log(`  ${KEY_COLOR("erro".padEnd(14))}: ${chalk.red(formatError(error))}`);
  console.log(`  ${KEY_COLOR("raw".padEnd(14))}: ${chalk.redBright(raw || "(vazio)")}`);
  console.log();
}

/** Erro final após todas as tentativas. */
export function logLlmFailure(durationMs: number, error: unknown): void {
  console.log(
    ERROR_COLOR("✖  [llm] todas as tentativas falharam") +
      " " +
      KEY_COLOR(`(${durationMs}ms)`) +
      "  " +
      ARROW +
      "  " +
      chalk.red(formatError(error)),
  );
  if (isModelNotFoundError(error)) {
    console.log(
      `  ${KEY_COLOR("dica".padEnd(14))}: ${chalk.yellow(
        "o endpoint respondeu, mas o modelo configurado não existe localmente",
      )}`,
    );
  }
  console.log();
}
