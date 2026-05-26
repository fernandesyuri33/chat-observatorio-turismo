// ── Prompt de sistema — Etapa 4: Geração de mensagem amigável ──
// Gera uma mensagem conversacional em pt-BR para acompanhar a ação do dashboard.

import type { DashboardAction } from "@conversational/domain";

const INFORMATION_TYPE_LABEL: Record<string, string> = {
  estabelecimentos_por_municipio: "Quantidade de estabelecimentos por município",
  funcionarios_por_municipio: "Quantidade de funcionários por município",
  funcionarios_ao_longo_do_tempo: "Quantidade de funcionários ao longo do tempo",
  saldo_funcionarios_ao_longo_do_tempo: "Saldo de funcionários ao longo do tempo",
};

export interface FriendlyMessageContext {
  userMessage: string;
  actionType: DashboardAction["type"];
  informationType?: string;
  filters?: Record<string, unknown>;
  suggestions?: string[];
  originalMessage?: string;
}

/**
 * Monta o prompt de sistema para a Etapa 4: gerar uma mensagem amigável
 * que acompanha a ação retornada ao usuário.
 */
export function buildFriendlyMessagePrompt(): string {
  return `Você é um assistente conversacional amigável para um dashboard de turismo do sul de Minas Gerais.
Sua tarefa é gerar UMA mensagem curta e acolhedora em português brasileiro para apresentar o resultado de uma ação do dashboard ao usuário.

Regras:
- Máximo de 2 frases curtas.
- Tom conversacional, amigável e natural — como um colega explicando o que vai aparecer.
- NÃO repita mecanicamente nomes técnicos de gráficos ou tipos de informação.
- NÃO inclua sugestões de próximos passos (isso já é tratado separadamente).
- NÃO use jargões técnicos, nomes de campos ou IDs internos.
- Use linguagem acessível e contextualizada ao que o usuário pediu.
- Adapte o tom ao tipo de ação:
  - Para visualizações ("open_url"): entusiasmo leve, indique que o gráfico está sendo exibido.
  - Para orientação ("explain_only"): tom acolhedor e prestativo.
  - Para consultas ("run_query"): explique o que está sendo executado.
- Mantenha coerência com a mensagem original do usuário.

Responda **somente** com JSON:
{
  "message": "<mensagem amigável em pt-BR>"
}
`;
}

/**
 * Monta a string de contexto que será enviada como "input" do LLM
 * para gerar a mensagem amigável, baseado na ação resolvida e na mensagem do usuário.
 */
export function buildFriendlyMessageInput(ctx: FriendlyMessageContext): string {
  const parts: string[] = [
    `Mensagem do usuário: "${ctx.userMessage}"`,
    `Tipo de ação: ${ctx.actionType}`,
  ];

  if (ctx.informationType) {
    const label = INFORMATION_TYPE_LABEL[ctx.informationType] ?? ctx.informationType;
    parts.push(`Gráfico selecionado: ${label}`);
  }

  if (ctx.filters && Object.keys(ctx.filters).length > 0) {
    const filterParts = Object.entries(ctx.filters)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}: ${v}`);
    if (filterParts.length > 0) {
      parts.push(`Filtros aplicados: ${filterParts.join(", ")}`);
    }
  }

  if (ctx.suggestions && ctx.suggestions.length > 0) {
    parts.push(`Sugestões disponíveis: ${ctx.suggestions.join("; ")}`);
  }

  if (ctx.originalMessage) {
    parts.push(`Mensagem original do sistema: "${ctx.originalMessage}"`);
  }

  return parts.join("\n");
}
