import type { Redis } from "ioredis";
import type { ConversationTurn } from "@conversational/llm";

export interface HistoryConfig {
  /** Número máximo de turnos (user + assistant) mantidos no contexto do LLM. */
  maxMessages: number;
  /** TTL do histórico no Redis em segundos. 0 = sem expiração. */
  ttlSeconds: number;
}

/**
 * Serviço de histórico de conversa com armazenamento no Redis.
 *
 * Cada conversa é identificada por um `conversationId` opaco gerado pelo cliente.
 * O histórico é serializado como JSON e armazenado sob a chave `history:{conversationId}`.
 * Convenção do payload persistido:
 * - role="user": mensagem bruta enviada pelo usuário.
 * - role="assistant": intent normalizada serializada em JSON (não DashboardAction).
 * Apenas os últimos `maxMessages` turnos são mantidos para limitar o contexto enviado ao LLM.
 */
export class HistoryService {
  constructor(
    private readonly redis: Redis,
    private readonly config: HistoryConfig
  ) {}

  /**
   * Retorna os turnos de conversa armazenados para o `conversationId` informado.
   * Retorna array vazio se não houver histórico ou se o JSON for inválido.
   */
  async get(conversationId: string): Promise<ConversationTurn[]> {
    const key = `history:${conversationId}`;
    const raw = await this.redis.get(key);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as ConversationTurn[];
    } catch {
      return [];
    }
  }

  /**
   * Adiciona novos turnos ao histórico da conversa e re-salva no Redis.
   * O histórico é truncado para os últimos `maxMessages` turnos antes de salvar.
   * O TTL é renovado a cada chamada.
   */
  async append(
    conversationId: string,
    newTurns: ConversationTurn[]
  ): Promise<void> {
    const key = `history:${conversationId}`;
    const existing = await this.get(conversationId);
    const merged = [...existing, ...newTurns];

    // Mantém apenas os últimos maxMessages turnos
    const trimmed = merged.slice(-this.config.maxMessages);
    const serialized = JSON.stringify(trimmed);

    if (this.config.ttlSeconds > 0) {
      await this.redis.setex(key, this.config.ttlSeconds, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }
}
