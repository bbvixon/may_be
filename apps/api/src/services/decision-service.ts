import type {
  AnalyzeDecisionRequest,
  AnalyzeDecisionResponse,
  ExpandNodeRequest,
  ExpandNodeResponse,
} from "@maybe/contracts";
import { analyzeWithOllama, expandWithOllama } from "../providers/ollama.js";
import { analyzeWithLMStudio } from "../providers/lmstudio.js";

const decisions = new Map<string, AnalyzeDecisionResponse>();
const expansionCache = new Map<string, ExpandNodeResponse>();
const expansionJobs = new Map<string, Promise<ExpandNodeResponse>>();

function provider() {
  return process.env.MAYBE_AI_PROVIDER ?? "ollama";
}

export async function analyzeDecision(
  request: AnalyzeDecisionRequest,
): Promise<AnalyzeDecisionResponse> {
  let result: AnalyzeDecisionResponse;
  if (provider() === "ollama") {
    result = normalizeAnalysis(request.input, await analyzeWithOllama(request));
  } else if (provider() === "lmstudio") {
    result = await analyzeWithLMStudio(request);
  } else {
    result = buildLocalDemo(request.input);
  }
  decisions.set(result.graph.decisionId, result);
  return result;
}

export async function expandDecisionNode(
  request: ExpandNodeRequest,
): Promise<ExpandNodeResponse> {
  const cacheKey = `${request.decisionId}:${request.nodeId}`;
  const cached = expansionCache.get(cacheKey);
  if (cached) return cached;
  const running = expansionJobs.get(cacheKey);
  if (running) return running;

  const analysis = decisions.get(request.decisionId);
  if (provider() === "ollama") {
    if (!analysis) throw new Error("Decision context is no longer available. Start again.");
    const job = expandWithOllama(request, analysis)
      .then((raw) => normalizeExpansion(request, raw))
      .then((result) => {
        const knownIds = new Set(analysis.graph.nodes.map((node) => node.id));
        analysis.graph.nodes.push(...result.nodes.filter((node) => !knownIds.has(node.id)));
        const knownEdges = new Set(analysis.graph.edges.map((edge) => edge.id));
        analysis.graph.edges.push(...result.edges.filter((edge) => !knownEdges.has(edge.id)));
        expansionCache.set(cacheKey, result);
        return result;
      })
      .finally(() => expansionJobs.delete(cacheKey));
    expansionJobs.set(cacheKey, job);
    return job;
  }
  const suffix = request.nodeId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return {
    parentNodeId: request.nodeId,
    nodes: [
      {
        id: `${suffix}-test`,
        label: "Test the path",
        summary: "Run a small reversible experiment before making the full commitment.",
        grounding: "assumption",
        factorIds: [],
        needsHumanInput: false,
      },
      {
        id: `${suffix}-learn`,
        label: "Learn more first",
        summary: "Gather the missing evidence that could materially change this branch.",
        grounding: "human_unknown",
        factorIds: [],
        needsHumanInput: true,
      },
    ],
    edges: [
      { id: `${suffix}-edge-test`, from: request.nodeId, to: `${suffix}-test` },
      { id: `${suffix}-edge-learn`, from: request.nodeId, to: `${suffix}-learn` },
    ],
  };
}

export function normalizeAnalysis(
  input: string,
  analysis: AnalyzeDecisionResponse,
): AnalyzeDecisionResponse {
  const alternatives = parseAlternatives(input);
  if (alternatives) {
    const [first, second] = alternatives;
    const rootId = "root";
    const branchFor = (label: string) => {
      const existing = analysis.graph.nodes.find(
        (node) => node.label.trim().toLowerCase() === label.toLowerCase(),
      );
      return {
        id: slug(label),
        label,
        summary: existing?.summary ?? `Explore what choosing ${label} would mean for you.`,
        grounding: existing?.grounding ?? ("user_fact" as const),
        factorIds: existing?.factorIds ?? [],
        needsHumanInput: existing?.needsHumanInput ?? false,
      };
    };
    const branches = [branchFor(first), branchFor(second)];
    const rootLabel = `${first} or ${second}?`;
    return {
      ...analysis,
      keywords: [first, second],
      graph: {
        decisionId: `decision-${Date.now()}`,
        title: rootLabel,
        rootNodeId: rootId,
        nodes: [
          {
            id: rootId,
            label: rootLabel,
            summary: input,
            grounding: "user_fact",
            factorIds: analysis.factors.map((factor) => factor.id),
            needsHumanInput: false,
          },
          ...branches,
        ],
        edges: branches.map((branch) => ({
          id: `${rootId}-${branch.id}`,
          from: rootId,
          to: branch.id,
        })),
      },
    };
  }

  const declaredRoot = analysis.graph.nodes.find(
    (node) => node.id === analysis.graph.rootNodeId,
  );
  const root = declaredRoot ?? {
    id: "root",
    label: analysis.graph.title,
    summary: input,
    grounding: "user_fact" as const,
    factorIds: analysis.factors.map((factor) => factor.id),
    needsHumanInput: false,
  };
  const branches = analysis.graph.nodes
    .filter((node) => node.id !== root.id)
    .slice(0, 6);
  if (!branches.length) return buildLocalDemo(input);
  return {
    ...analysis,
    graph: {
      ...analysis.graph,
      decisionId: `decision-${Date.now()}`,
      rootNodeId: root.id,
      nodes: [root, ...branches],
      edges: branches.map((branch) => ({
        id: `${root.id}-${branch.id}`,
        from: root.id,
        to: branch.id,
      })),
    },
  };
}

function normalizeExpansion(
  request: ExpandNodeRequest,
  expansion: ExpandNodeResponse,
): ExpandNodeResponse {
  const nodes = expansion.nodes.slice(0, 3).map((node, index) => ({
    ...node,
    label: compactLabel(node.label),
    id: `${slug(request.nodeId)}-${slug(compactLabel(node.label))}-${index + 1}`,
  }));
  return {
    parentNodeId: request.nodeId,
    nodes,
    edges: nodes.map((node) => ({
      id: `${request.nodeId}-${node.id}`,
      from: request.nodeId,
      to: node.id,
    })),
  };
}

function compactLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ");
  if (words.length <= 3 && normalized.length <= 22) return normalized;
  const compact = words.filter((word) => !/^(a|an|and|for|of|the|to|under|with)$/i.test(word));
  const selected = compact.length > 3
    ? [compact[0], compact[1], compact.at(-1)!]
    : compact.slice(0, 3);
  const label = selected.join(" ");
  return label.length <= 22 ? label : `${label.slice(0, 21).trimEnd()}…`;
}

export function buildLocalDemo(input: string): AnalyzeDecisionResponse {
  const alternatives = parseAlternatives(input);
  if (alternatives) return buildAlternativeDemo(input, alternatives);
  const isMove = /bangalore|move|relocat|job offer/i.test(input);
  const decisionId = `decision-${Date.now()}`;
  const rootId = "root";
  const branches = isMove
    ? [
        ["go", "Go", "Accept the opportunity and plan the move."],
        ["stay", "Stay", "Remain close to your support system and seek growth locally."],
        ["negotiate", "Negotiate", "Change the conditions before committing."],
      ]
    : [
        ["act", "Act now", "Commit to the change using the facts currently available."],
        ["test", "Test it", "Run a smaller reversible experiment first."],
        ["wait", "Wait", "Gather the missing information before choosing."],
      ];

  return {
    keywords: extractKeywords(input),
    framing: isMove
      ? "You are deciding whether the opportunity is worth the distance and disruption it creates."
      : "You are balancing the value of acting now against the value of learning more first.",
    factors: [
      {
        id: "input",
        label: "Your situation",
        value: input,
        grounding: "user_fact",
        confidence: 1,
        editable: true,
      },
      {
        id: "uncertainty",
        label: "How reversible is this choice?",
        grounding: "human_unknown",
        editable: true,
      },
    ],
    graph: {
      decisionId,
      title: isMove ? "Move to Bangalore?" : "Which path should I explore?",
      rootNodeId: rootId,
      nodes: [
        {
          id: rootId,
          label: isMove ? "Move to Bangalore?" : "Your decision",
          summary: input,
          grounding: "user_fact",
          factorIds: ["input"],
          needsHumanInput: false,
        },
        ...branches.map(([id, label, summary]) => ({
          id,
          label,
          summary,
          grounding: "assumption" as const,
          factorIds: ["input", "uncertainty"],
          needsHumanInput: false,
        })),
      ],
      edges: branches.map(([id]) => ({ id: `root-${id}`, from: rootId, to: id })),
    },
  };
}

function buildAlternativeDemo(
  input: string,
  [first, second]: [string, string],
): AnalyzeDecisionResponse {
  const firstId = slug(first);
  const secondId = slug(second);
  const decisionId = `decision-${Date.now()}`;
  const rootLabel = `${first} or ${second}?`;

  return {
    keywords: [first, second],
    framing: `You are choosing between ${first} and ${second}.`,
    factors: [
      {
        id: "stated-options",
        label: "Options you named",
        value: input,
        grounding: "user_fact",
        confidence: 1,
        editable: true,
      },
      {
        id: "criteria",
        label: "What matters most in this choice?",
        grounding: "human_unknown",
        editable: true,
      },
    ],
    graph: {
      decisionId,
      title: rootLabel,
      rootNodeId: "root",
      nodes: [
        {
          id: "root",
          label: rootLabel,
          summary: input,
          grounding: "user_fact",
          factorIds: ["stated-options", "criteria"],
          needsHumanInput: false,
        },
        {
          id: firstId,
          label: first,
          summary: `Explore what choosing ${first} would mean for you.`,
          grounding: "user_fact",
          factorIds: ["stated-options", "criteria"],
          needsHumanInput: false,
        },
        {
          id: secondId,
          label: second,
          summary: `Explore what choosing ${second} would mean for you.`,
          grounding: "user_fact",
          factorIds: ["stated-options", "criteria"],
          needsHumanInput: false,
        },
      ],
      edges: [
        { id: `root-${firstId}`, from: "root", to: firstId },
        { id: `root-${secondId}`, from: "root", to: secondId },
      ],
    },
  };
}

function parseAlternatives(input: string): [string, string] | null {
  const cleaned = input
    .trim()
    .replace(/[?.!]+$/, "")
    .replace(/^(?:should\s+i\s+)?(?:choose|pick|buy|use|get)\s+/i, "");
  const match = cleaned.match(/^(.{1,48}?)\s+(?:or|vs\.?|versus)\s+(.{1,48})$/i);
  if (!match) return null;
  return [displayChoice(match[1]), displayChoice(match[2])];
}

function displayChoice(value: string) {
  const trimmed = value.trim();
  const known = new Map([
    ["android", "Android"],
    ["ios", "iOS"],
    ["iphone", "iPhone"],
  ]);
  return known.get(trimmed.toLowerCase()) ?? trimmed.replace(/^./, (letter) => letter.toUpperCase());
}

function extractKeywords(input: string) {
  const stopWords = new Set([
    "about", "after", "again", "also", "because", "before", "being", "could",
    "from", "have", "into", "means", "should", "that", "their", "there", "they",
    "this", "want", "what", "when", "where", "which", "with", "would", "your",
  ]);
  const words = input.match(/[A-Za-z0-9₹$][A-Za-z0-9₹$'.-]*/g) ?? [];
  const seen = new Set<string>();
  const keywords = words.filter((word) => {
    const normalized = word.toLowerCase();
    if (word.length < 3 || stopWords.has(normalized) || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).slice(0, 8);
  return keywords.length ? keywords : [input.trim().slice(0, 48)];
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "option";
}
