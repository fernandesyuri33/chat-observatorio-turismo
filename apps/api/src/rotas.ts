import type { FastifyInstance } from "fastify";
import {
  PostMensagemRequestSchema,
  PostMensagemResponseSchema,
} from "@conversational/contracts";
import type { ConversationTurn } from "@conversational/llm";
import { summarizeAssistantTurn } from "@conversational/llm";
import { resolveDashboardAction } from "@conversational/application";
import type { ResolveDashboardActionDeps } from "@conversational/application";
import type { HistoryService } from "./history.service.js";

// ── Registro de rota ────────────────────────────────────────────

export async function rotas(app: FastifyInstance) {
  const di = (app as unknown as { di: ResolveDashboardActionDeps }).di;
  const historyService = (app as unknown as { historyService: HistoryService }).historyService;

  app.post("/mensagem", async (request, reply) => {
    const parsed = PostMensagemRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Requisição inválida",
        details: parsed.error.flatten(),
      });
    }

    // ── Histórico de conversa ─────────────────────────────────────
    const conversationId = request.headers["x-conversation-id"];
    const history =
      typeof conversationId === "string" && conversationId.length > 0
        ? await historyService.get(conversationId)
        : [];

    let resolvedIntentPayload: string | undefined;

    const action = await resolveDashboardAction(di, {
      message: parsed.data.message,
      ctx: parsed.data.ctx,
      history,
      onIntentResolved(intent) {
        resolvedIntentPayload = JSON.stringify(intent);
      },
    });

    // ── Persiste novos turnos no histórico ────────────────────────
    if (typeof conversationId === "string" && conversationId.length > 0) {
      const turnsToPersist: ConversationTurn[] = [
        { role: "user", content: parsed.data.message },
      ];

      if (resolvedIntentPayload) {
        turnsToPersist.push({ role: "assistant", content: summarizeAssistantTurn(resolvedIntentPayload) });
      }

      await historyService.append(conversationId, turnsToPersist);
    }

    // Valida resposta de saída para garantir conformidade com o contrato
    const response = PostMensagemResponseSchema.parse({ action });
    return reply.status(200).send(response);
  });
}
