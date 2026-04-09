import type { InformationType } from "./intent.v1.schema.js";

// ── Definição dos gráficos disponíveis no dashboard ─────────────

export interface GraficoDashboard {
  /** Identificador do tipo de informação (corresponde ao InformationType do schema). */
  informationType: InformationType;
  /** Descrição em linguagem natural do gráfico, usada em prompts para o LLM. */
  descricao: string;
  /**
   * Variações de pedidos do usuário que correspondem a este gráfico.
   * Usado nos prompts para que o LLM faça inferência semântica mesmo quando
   * o usuário não menciona o nome exato do gráfico.
   */
  variacoes: string[];
}

/**
 * Lista dos gráficos disponíveis no dashboard de turismo do sul de Minas Gerais.
 * Cada entrada mapeia um tipo de informação a uma descrição legível que ajuda
 * o LLM a determinar se o pedido do usuário corresponde a um gráfico existente.
 */
export const GRAFICOS_DASHBOARD: GraficoDashboard[] = [
  {
    informationType: "funcionarios_ao_longo_do_tempo",
    descricao: "Funcionários ao longo do tempo — evolução temporal do número de funcionários no setor turístico",
    variacoes: [
      "evolução do número de funcionários",
      "funcionários ao longo dos anos",
      "como o emprego no turismo mudou com o tempo",
      "tendência de contratações no setor turístico",
      "histórico de funcionários",
    ],
  },
  {
    informationType: "saldo_funcionarios_ao_longo_do_tempo",
    descricao: "Saldo de funcionários ao longo do tempo — diferença entre admissões e desligamentos ao longo do tempo",
    variacoes: [
      "saldo de empregos ao longo do tempo",
      "diferença entre admissões e demissões",
      "balanço de contratações e desligamentos",
      "evolução do saldo de empregos turísticos",
      "quantas vagas foram abertas e fechadas",
    ],
  },
  {
    informationType: "funcionarios_por_municipio",
    descricao: "Funcionários por município — distribuição de funcionários entre os municípios",
    variacoes: [
      "comparar funcionários entre municípios",
      "quais cidades têm mais empregos no turismo",
      "distribuição de empregos por cidade",
      "ranking de municípios por número de funcionários",
      "onde o turismo emprega mais pessoas",
    ],
  },
  {
    informationType: "estabelecimentos_por_municipio",
    descricao: "Estabelecimentos por município — quantidade de estabelecimentos turísticos por município",
    variacoes: [
      "comparar estabelecimentos entre municípios",
      "quais cidades têm mais estabelecimentos turísticos",
      "distribuição de estabelecimentos por município",
      "ranking de municípios por estabelecimentos",
      "quantidade de estabelecimentos em cada cidade",
    ],
  },
];
