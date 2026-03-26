import type { PolicyConfig } from "@conversational/policy";

type CuriosityFaqEntry = NonNullable<PolicyConfig["curiosityFaq"]>[number];

// ── Utilitários de texto ────────────────────────────────────────

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeText(value: string): Set<string> {
  const normalized = normalizeText(value).replace(/[^a-z0-9\s]/g, " ");
  return new Set(normalized.split(/\s+/).filter((token) => token.length >= 3));
}

// ── Scoring ─────────────────────────────────────────────────────

export function scoreFaqMatch(message: string, example: string): number {
  const messageTokens = tokenizeText(message);
  const exampleTokens = tokenizeText(example);

  if (messageTokens.size === 0 || exampleTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of messageTokens) {
    if (exampleTokens.has(token)) {
      intersection += 1;
    }
  }

  if (intersection < 2) {
    return 0;
  }

  return intersection / exampleTokens.size;
}

// ── Matcher principal ───────────────────────────────────────────

const MIN_MATCH_SCORE = 0.45;

/**
 * Busca a melhor correspondência de FAQ para uma mensagem de curiosidade.
 * Retorna undefined se nenhuma entrada atinge o score mínimo (0.45).
 */
export function findCuriosityFaqMatch(
  message: string,
  entries?: PolicyConfig["curiosityFaq"]
): CuriosityFaqEntry | undefined {
  if (!entries || entries.length === 0) {
    return undefined;
  }

  let bestScore = 0;
  let bestEntry: CuriosityFaqEntry | undefined;

  for (const entry of entries) {
    for (const example of entry.questionExamples) {
      const score = scoreFaqMatch(message, example);
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
  }

  if (bestScore < MIN_MATCH_SCORE) {
    return undefined;
  }

  return bestEntry;
}
