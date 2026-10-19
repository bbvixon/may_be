import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerDecisionRoutes } from "./routes/decisions.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:4173",
  });

  app.get("/health", async () => ({
    ok: true,
    aiProvider: process.env.MAYBE_AI_PROVIDER ?? "ollama",
    aiModel: process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct",
  }));

  await app.register(registerDecisionRoutes, { prefix: "/v1/decisions" });
  return app;
}
