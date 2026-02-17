import type { FastifyInstance } from "fastify";
import {
  ResolveDashboardRequestSchema,
  ResolveDashboardResponseSchema,
} from "@conversational/domain";
import { resolveDashboardAction } from "@conversational/application";
import type { ResolveDashboardActionDeps } from "@conversational/application";

// ── Route registration ──────────────────────────────────────────

export async function dashboardRoutes(app: FastifyInstance) {
  const di = (app as unknown as { di: ResolveDashboardActionDeps }).di;

  app.post("/dashboard/resolve", async (request, reply) => {
    const parsed = ResolveDashboardRequestSchema.safeParse(request.body);
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

    // Validate outbound response to ensure contract compliance
    const response = ResolveDashboardResponseSchema.parse({ action });
    return reply.status(200).send(response);
  });
}
