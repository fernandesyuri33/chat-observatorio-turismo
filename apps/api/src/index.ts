import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { FiltersSchema } from "@conversational/contracts";
import { interpretMessage } from "./llm";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const InterpretRequestSchema = z.object({
  message: z.string().min(1),
  currentFilters: FiltersSchema.optional().default({})
});

app.get("/health", async () => ({ status: "ok" }));

app.post("/interpret", async (request, reply) => {
  const parsed = InterpretRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid request" });
  }

  const { message, currentFilters } = parsed.data;
  const result = await interpretMessage(message, currentFilters);
  return reply.status(200).send(result);
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

app.listen({ port, host });
