import {
  AnalyzeDecisionResponseSchema,
  ExpandNodeResponseSchema,
  type AnalyzeDecisionRequest,
  type AnalyzeDecisionResponse,
  type ExpandNodeRequest,
} from "@maybe/contracts";
import { z } from "zod";

type OllamaChatResponse = { message?: { content?: string } };
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return value;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  if (maxLength === 1) return normalized.slice(0, 1);
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Structured output keeps the response shape predictable, but small local models
 * can still exceed string bounds. Clamp only bounded presentation fields here;
 * Zod remains responsible for rejecting missing or structurally invalid data.
 */
function sanitizeDecisionPayload(value: unknown) {
  if (!isObject(value)) return value;

  const graph = isObject(value.graph) ? value.graph : undefined;
  const nodes = Array.isArray(graph?.nodes)
    ? graph.nodes.map((node) => isObject(node)
      ? {
          ...node,
          label: boundedText(node.label, 48),
          summary: boundedText(node.summary, 320),
        }
      : node)
    : graph?.nodes;
  const edges = Array.isArray(graph?.edges)
    ? graph.edges.map((edge) => isObject(edge)
      ? { ...edge, label: boundedText(edge.label, 80) }
      : edge)
    : graph?.edges;

  return {
    ...value,
    keywords: Array.isArray(value.keywords)
      ? value.keywords.map((keyword) => boundedText(keyword, 48))
      : value.keywords,
    framing: boundedText(value.framing, 220),
    graph: graph
      ? {
          ...graph,
          title: boundedText(graph.title, 120),
          nodes,
          edges,
        }
      : value.graph,
  };
}

function sanitizeExpansionPayload(value: unknown) {
  if (!isObject(value)) return value;
  return {
    ...value,
    nodes: Array.isArray(value.nodes)
      ? value.nodes.map((node) => isObject(node)
        ? {
            ...node,
            label: boundedText(node.label, 48),
            summary: boundedText(node.summary, 320),
          }
        : node)
      : value.nodes,
    edges: Array.isArray(value.edges)
      ? value.edges.map((edge) => isObject(edge)
        ? { ...edge, label: boundedText(edge.label, 80) }
        : edge)
      : value.edges,
  };
}

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
      think: false,
      keep_alive: "10m",
      format: schema,
      options: { temperature: 0, num_predict: 1200 },
      messages: [
        {
          role: "system",
          content: [
            "You are the scenario modeller for may.be.",
            "Model plausible paths; never claim to predict the future.",
            "Separate user facts, evidence, assumptions, and human unknowns.",
            "Create 2 to 6 materially different first branches.",
            "A human unknown must set needsHumanInput=true.",
            "Every graph node label must be 1 to 3 words and at most 22 characters. Put explanations in summary, never in labels.",
            "Every keyword must be an exact contiguous phrase copied from the user's input; never replace their words with abstract themes.",
            "When the user gives explicit alternatives such as A or B, the root and first branches must preserve A and B.",
            "Return only the JSON object required by the supplied response schema.",
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
  return AnalyzeDecisionResponseSchema.parse(
    sanitizeDecisionPayload(JSON.parse(payload.message.content)),
  );
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
      think: false,
      keep_alive: "10m",
      format: schema,
      options: { temperature: 0, num_predict: 900 },
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
            "Return only the JSON object required by the supplied response schema.",
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
  return ExpandNodeResponseSchema.parse(
    sanitizeExpansionPayload(JSON.parse(payload.message.content)),
  );
}
