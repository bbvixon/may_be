import cors from "@fastify/cors";
import Fastify, { type FastifyReply } from "fastify";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerDecisionRoutes } from "./routes/decisions.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(moduleDirectory, "../../web/dist");

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendWebFile(reply: FastifyReply, filePath: string) {
  const contentType = contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
  return reply.type(contentType).send(createReadStream(filePath));
}

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

  app.get("/", async (_request, reply) => {
    return sendWebFile(reply, path.join(webRoot, "index.html"));
  });

  app.get("/*", async (request, reply) => {
    const requestedPath = (request.params as { "*": string })["*"];
    const candidate = path.resolve(webRoot, requestedPath);

    if (requestedPath.startsWith("v1/") || !candidate.startsWith(`${webRoot}${path.sep}`)) {
      return reply.code(404).send({ error: "Not found" });
    }

    try {
      await access(candidate);
      return sendWebFile(reply, candidate);
    } catch {
      return sendWebFile(reply, path.join(webRoot, "index.html"));
    }
  });

  return app;
}
