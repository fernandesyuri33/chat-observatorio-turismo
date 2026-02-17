import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { DashboardActionSchema } from "@conversational/domain";
import { resolveDashboardAction } from "@conversational/application";
import type { ResolveDashboardActionDeps } from "@conversational/application";

// ── Request / Response schemas ──────────────────────────────────

const ResolveRequestSchema = z.object({
  message: z.string().min(1),
  ctx: z
    .object({
      dashboardId: z.string().optional(),
      currentFilters: z.record(z.any()).optional(),
    })
    .optional(),
});

const ResolveResponseSchema = z.object({
  action: DashboardActionSchema,
});

// ── Route registration ──────────────────────────────────────────

export async function dashboardRoutes(app: FastifyInstance) {
  const di = (app as unknown as { di: ResolveDashboardActionDeps }).di;

  app.post("/dashboard/resolve", async (request, reply) => {
    const parsed = ResolveRequestSchema.safeParse(request.body);
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
    const response = ResolveResponseSchema.parse({ action });
    return reply.status(200).send(response);
  });
}
