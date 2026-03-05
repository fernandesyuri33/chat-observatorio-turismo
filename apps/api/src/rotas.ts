import type { FastifyInstance } from "fastify";
import {
  PostMensagemRequestSchema,
  PostMensagemResponseSchema,
} from "@conversational/contracts";
import { resolveDashboardAction } from "@conversational/application";
import type { ResolveDashboardActionDeps } from "@conversational/application";

// ── Registro de rota ────────────────────────────────────────────

export async function rotas(app: FastifyInstance) {
  const di = (app as unknown as { di: ResolveDashboardActionDeps }).di;

  app.post("/mensagem", async (request, reply) => {
    const parsed = PostMensagemRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Requisição inválida",
        details: parsed.error.flatten(),
      });
    }

    const action = await resolveDashboardAction(di, {
      message: parsed.data.message,
      ctx: parsed.data.ctx,
    });

    // Valida resposta de saída para garantir conformidade com o contrato
    const response = PostMensagemResponseSchema.parse({ action });
    return reply.status(200).send(response);
  });
}
