import type { InformationType } from "./intent.v1.schema.js";

// ── Definição dos gráficos disponíveis no dashboard ─────────────

export interface GraficoDashboard {
  /** Identificador do tipo de informação (corresponde ao InformationType do schema). */
  informationType: InformationType;
  /** Descrição em linguagem natural do gráfico, usada em prompts para o LLM. */
  descricao: string;
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
  },
  {
    informationType: "saldo_funcionarios_ao_longo_do_tempo",
    descricao: "Saldo de funcionários ao longo do tempo — diferença entre admissões e desligamentos ao longo do tempo",
  },
  {
    informationType: "funcionarios_por_municipio",
    descricao: "Funcionários por município — distribuição de funcionários entre os municípios",
  },
  {
    informationType: "estabelecimentos_por_municipio",
    descricao: "Estabelecimentos por município — quantidade de estabelecimentos turísticos por município",
  },
];
