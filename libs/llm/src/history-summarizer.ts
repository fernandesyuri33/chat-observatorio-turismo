// ── Sumarizador de turnos assistant no histórico ────────────────
// Converte o JSON bruto de NormalizedIntent armazenado no Redis em
// texto natural pt-BR antes de injetar no contexto do LLM, evitando
// que o modelo mimetize o formato JSON das respostas anteriores.

import { GRAFICOS_DASHBOARD } from "@conversational/domain";

const INFORMATION_TYPE_LABELS: Record<string, string> = {};
for (const g of GRAFICOS_DASHBOARD) {
  INFORMATION_TYPE_LABELS[g.informationType] = g.descricao;
}

function describeInformationType(it: string): string {
  return INFORMATION_TYPE_LABELS[it] ?? it;
}

function describeFilters(
  filters: Record<string, unknown> | undefined,
): string {
  if (!filters) return "";
  const parts: string[] = [];
  if (typeof filters["classificacao"] === "string") {
    parts.push(`classificação "${filters["classificacao"]}"`);
  }
  if (typeof filters["municipio"] === "string") {
    parts.push(`município "${filters["municipio"]}"`);
  }
  return parts.length > 0 ? `, com filtros: ${parts.join(" e ")}` : "";
}

/**
 * Converte o conteúdo JSON de um turno de assistant (NormalizedIntent serializado)
 * em um resumo em linguagem natural pt-BR, adequado para injeção como contexto
 * de histórico em chamadas ao LLM.
 *
 * Se o conteúdo não for JSON válido ou não tiver a estrutura esperada, retorna
 * uma descrição genérica para não poluir o contexto.
 */
export function summarizeAssistantTurn(content: string): string {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return "Resposta anterior do assistente (contexto indisponível).";
  }

  const intent = parsed["intent"];
  const filters = parsed["proposedFilters"] as
    | Record<string, unknown>
    | undefined;
  const filterDesc = describeFilters(filters);

  switch (intent) {
    case "show": {
      const it = parsed["informationType"];
      const label =
        typeof it === "string" ? describeInformationType(it) : "um gráfico";
      return `O assistente entendeu que o usuário quis ver: ${label}${filterDesc}.`;
    }

    case "contextual_orientation":
      return `O assistente entendeu que o usuário forneceu contexto de filtros${filterDesc}, mas não especificou qual análise desejava ver.`;

    case "initial_orientation":
      return "O assistente forneceu uma orientação inicial sobre as funcionalidades do dashboard.";

    case "curiosity_to_action":
      return `O assistente respondeu a uma pergunta de curiosidade do usuário sobre o domínio de turismo${filterDesc}.`;

    default:
      return "Resposta anterior do assistente (contexto indisponível).";
  }
}
