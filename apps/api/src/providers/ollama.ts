import {
  AnalyzeDecisionResponseSchema,
  ExpandNodeResponseSchema,
  type AnalyzeDecisionRequest,
  type AnalyzeDecisionResponse,
  type ExpandNodeRequest,
} from "@maybe/contracts";
import { z } from "zod";

type OllamaChatResponse = { message?: { content?: string } };

export async function analyzeWithOllama(input: AnalyzeDecisionRequest) {
  const endpoint = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct";
  const schema = z.toJSONSchema(AnalyzeDecisionResponseSchema);

  const response = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: schema,
      options: { temperature: 0 },
      messages: [
        {
          role: "system",
          content: [
            "You are the scenario modeller for may.be.",
            "Model plausible paths; never claim to predict the future.",
            "Separate user facts, evidence, assumptions, and human unknowns.",
            "Create 2 to 6 materially different first branches.",
            "A human unknown must set needsHumanInput=true.",
            "Every keyword must be an exact contiguous phrase copied from the user's input; never replace their words with abstract themes.",
            "When the user gives explicit alternatives such as A or B, the root and first branches must preserve A and B.",
            `Return JSON matching this schema: ${JSON.stringify(schema)}`,
          ].join("\n"),
        },
        { role: "user", content: input.input },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with ${response.status}`);
  }

  const payload = (await response.json()) as OllamaChatResponse;
  if (!payload.message?.content) throw new Error("Ollama returned no content");
  return AnalyzeDecisionResponseSchema.parse(JSON.parse(payload.message.content));
}

export async function expandWithOllama(
  input: ExpandNodeRequest,
  analysis: AnalyzeDecisionResponse,
) {
  const endpoint = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct";
  const schema = z.toJSONSchema(ExpandNodeResponseSchema);
  const parent = analysis.graph.nodes.find((node) => node.id === input.nodeId);
  if (!parent) throw new Error(`Unknown decision node: ${input.nodeId}`);

  const response = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: schema,
      options: { temperature: 0 },
      messages: [
        {
          role: "system",
          content: [
            "You expand one selected path in a may.be decision graph.",
            "Return exactly 3 concrete, materially different next outcomes that follow from the selected path.",
            "Never use generic labels such as Test the path, Learn more, Act now, Wait, or Think more.",
            "Every label must be 1 to 3 words and at most 22 characters. Put all explanation in summary, never in label.",
            "Do not predict the future; mark assumptions and human unknowns honestly.",
            "parentNodeId must exactly equal the selected node id.",
            "Every edge must start at parentNodeId and point to one returned node.",
            `Return JSON matching this schema: ${JSON.stringify(schema)}`,
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            decision: analysis.graph.title,
            framing: analysis.framing,
            factors: analysis.factors,
            selectedPath: parent,
            userContext: input.userContext,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama expansion failed with ${response.status}`);
  }

  const payload = (await response.json()) as OllamaChatResponse;
  if (!payload.message?.content) throw new Error("Ollama returned no expansion content");
  return ExpandNodeResponseSchema.parse(JSON.parse(payload.message.content));
}
