import {
  AnalyzeDecisionRequestSchema,
  AnalyzeDecisionResponseSchema,
  ExpandNodeRequestSchema,
  ExpandNodeResponseSchema,
} from "@maybe/contracts";
import type { FastifyPluginAsync } from "fastify";
import { analyzeDecision, expandDecisionNode } from "../services/decision-service.js";

export const registerDecisionRoutes: FastifyPluginAsync = async (app) => {
  app.post("/analyze", async (request, reply) => {
    const parsed = AnalyzeDecisionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_decision", issues: parsed.error.issues });
    }

    const result = await analyzeDecision(parsed.data);
    return AnalyzeDecisionResponseSchema.parse(result);
  });

  app.post("/expand", async (request, reply) => {
    const parsed = ExpandNodeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_expansion", issues: parsed.error.issues });
    }

    return ExpandNodeResponseSchema.parse(await expandDecisionNode(parsed.data));
  });
};
