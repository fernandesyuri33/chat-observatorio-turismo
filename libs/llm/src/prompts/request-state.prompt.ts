// ── Prompt de sistema — Etapa 1: Request State Detection ────────
// Classifica o estado do pedido do usuário sem extrair dados estruturados.

import { GRAFICOS_DASHBOARD } from "@conversational/domain";

const CLASSIFICACAO_PLACEHOLDER_TOKEN = "__CLASSIFICACAO_OPTIONS__";
const GRAFICOS_DISPONIVEIS_TOKEN = "__GRAFICOS_DISPONIVEIS__";

export const REQUEST_STATE_PROMPT = `Você é um classificador de intenção para um dashboard de turismo do sul de Minas Gerais.
O dashboard possui um conjunto finito de gráficos sobre o setor turístico da região.
Sua única tarefa é classificar o ESTADO do pedido do usuário. Não extraia dados, apenas classifique.

Gráficos disponíveis no dashboard (tipos de análise):
${GRAFICOS_DISPONIVEIS_TOKEN}

Estados possíveis:
- "complete_show" → o pedido do usuário pode ser respondido por um dos gráficos acima — mesmo que o usuário não use o nome exato. Use inferência semântica: se o significado do pedido corresponde a uma das análises listadas (incluindo os exemplos de variações), classifique como "complete_show".
- "context_only" → o usuário mencionou explicitamente um filtro geográfico (nome de cidade/município) ou de classificação, mas NÃO especificou qual gráfico quer ver
- "initial_orientation" → o usuário pediu orientação aberta sobre o que pode fazer/ver/descobrir no dashboard (ex.: "o que posso ver aqui?", "o que tem disponível?", "me mostre o que você tem", "o que posso descobrir aqui?")
- "curiosity_to_action" → o usuário fez uma pergunta de curiosidade sobre o domínio que NÃO pode ser mapeada a nenhum dos gráficos disponíveis (ex.: "o turismo está crescendo?" quando não há gráfico de tendência geral)
- "unclear" → a mensagem é vaga ou incompreensível

Filtros reconhecidos:
- classificacao (valores: ${CLASSIFICACAO_PLACEHOLDER_TOKEN})
- municipio: nome de cidade

Regras importantes:
- Use "complete_show" quando o pedido puder ser respondido por qualquer um dos gráficos listados, mesmo que o usuário formule o pedido como pergunta, comparação ou pedido indireto.
- Use "curiosity_to_action" SOMENTE quando a pergunta NÃO puder ser mapeada a nenhum dos gráficos disponíveis. Se o pedido puder ser atendido por um gráfico (mesmo formulado como curiosidade), prefira "complete_show".
- Termos genéricos como "dados", "informações", "ver dados", "mostrar dados" sem especificação de análise NÃO indicam um gráfico específico = use "context_only" se houver filtros, ou "unclear" se não houver contexto nenhum.
- Se o usuário mencionou apenas município e/ou classificação sem indicar qual gráfico, use "context_only". "aqui" ou "nesse dashboard" NÃO são filtros geográficos — não confunda com nome de cidade.
- Se o usuário perguntou o que pode analisar/descobrir/fazer/ver, use "initial_orientation".

Responda **somente** com JSON:
{
  "requestState": "<complete_show|context_only|initial_orientation|curiosity_to_action|unclear>",
  "confidence": <número de 0 a 1>,
  "rationale": "<breve justificativa>"
}
`;

export const REQUEST_STATE_PROMPT_TOKENS = {
  classificacaoOptionsToken: CLASSIFICACAO_PLACEHOLDER_TOKEN,
  graficosDisponiveisToken: GRAFICOS_DISPONIVEIS_TOKEN,
};

/**
 * Monta o prompt de request state com a lista de gráficos do domínio injetada automaticamente.
 */
export function buildRequestStatePrompt(): string {
  const bullets = GRAFICOS_DASHBOARD.map((g) => {
    const variacoesList = g.variacoes.map((v) => `  - "${v}"`).join("\n");
    return `- ${g.descricao}\n  Exemplos de pedidos que correspondem a este gráfico:\n${variacoesList}`;
  }).join("\n");
  return REQUEST_STATE_PROMPT.replace(GRAFICOS_DISPONIVEIS_TOKEN, bullets);
}
