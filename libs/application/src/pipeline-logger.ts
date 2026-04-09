import chalk from "chalk";

// ── Layout constants ────────────────────────────────────────────
const BOX_WIDTH = 58;
const STEP_COLOR = chalk.cyanBright.bold;
const STEP_BORDER = chalk.cyan;
const WARN_COLOR = chalk.yellow.bold;
const OUTPUT_COLOR = chalk.greenBright.bold;
const OUTPUT_BORDER = chalk.green;
const KEY_COLOR = chalk.dim;
const VALUE_COLOR = chalk.white;
const FALLBACK_COLOR = chalk.yellow;
const ARROW = chalk.yellow("→");

function boxLine(content: string, borderColor: typeof STEP_BORDER): void {
  const padded = ` ${content}`;
  const padding = " ".repeat(Math.max(0, BOX_WIDTH - padded.length - 1));
  console.log(borderColor("│") + STEP_COLOR(padded) + padding + borderColor("│"));
}

function printBox(
  title: string,
  borderColor: typeof STEP_BORDER,
  titleColor: typeof STEP_COLOR,
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

// ── Public API ──────────────────────────────────────────────────

/** Header de início de etapa — imprime só o box, sem campos (use logInfo para o resultado). */
export function logStepStart(stepNum: number, title: string): void {
  printBox(`ETAPA ${stepNum} — ${title}`, STEP_BORDER, STEP_COLOR);
}

/** Divisor e campos de uma etapa numerada (ex: "ETAPA 1 — Request State Detection"). */
export function logStep(
  stepNum: number,
  title: string,
  fields?: Record<string, unknown>,
): void {
  printBox(`ETAPA ${stepNum} — ${title}`, STEP_BORDER, STEP_COLOR, fields);
}

/** Box de saída final (resultado DashboardAction). */
export function logOutput(actionType: string, fields?: Record<string, unknown>): void {
  printBox(`OUTPUT → ${actionType}`, OUTPUT_BORDER, OUTPUT_COLOR, fields);
}

/** Aviso de fallback com motivo. */
export function logFallback(label: string, reason: string): void {
  console.log(WARN_COLOR(`⚠  [flow] ${label}`) + "  " + ARROW + "  " + FALLBACK_COLOR(reason));
  console.log();
}

/** Evento informativo simples (sem box). */
export function logInfo(label: string, fields?: Record<string, unknown>): void {
  console.log(KEY_COLOR(`   [flow] ${label}`));
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      console.log(`  ${KEY_COLOR(k.padEnd(14))}: ${VALUE_COLOR(formatValue(v))}`);
    }
    console.log();
  }
}
