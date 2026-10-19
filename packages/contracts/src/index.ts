import { z } from "zod";

export const GroundingKindSchema = z.enum([
  "user_fact",
  "evidence",
  "assumption",
  "human_unknown",
]);

export const DecisionFactorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().optional(),
  grounding: GroundingKindSchema,
  confidence: z.number().min(0).max(1).optional(),
  editable: z.boolean().default(true),
});

export const DecisionNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(48),
  summary: z.string().min(1).max(320),
  grounding: GroundingKindSchema,
  factorIds: z.array(z.string()).default([]),
  needsHumanInput: z.boolean().default(false),
});

export const DecisionEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().max(80).optional(),
});

export const DecisionGraphSchema = z.object({
  decisionId: z.string().min(1),
  title: z.string().min(1).max(120),
  rootNodeId: z.string().min(1),
  nodes: z.array(DecisionNodeSchema).min(2),
  edges: z.array(DecisionEdgeSchema).min(1),
});

export const AnalyzeDecisionRequestSchema = z.object({
  input: z.string().trim().min(12).max(6000),
  locale: z.string().default("en-IN"),
});

export const AnalyzeDecisionResponseSchema = z.object({
  keywords: z.array(z.string().min(1).max(48)).min(1).max(8),
  framing: z.string().min(1).max(220),
  factors: z.array(DecisionFactorSchema).min(1),
  graph: DecisionGraphSchema,
});

export const ExpandNodeRequestSchema = z.object({
  decisionId: z.string().min(1),
  nodeId: z.string().min(1),
  userContext: z.string().max(2000).optional(),
});

export const ExpandNodeResponseSchema = z.object({
  parentNodeId: z.string().min(1),
  nodes: z.array(DecisionNodeSchema).min(1).max(6),
  edges: z.array(DecisionEdgeSchema).min(1).max(6),
});

export type GroundingKind = z.infer<typeof GroundingKindSchema>;
export type DecisionFactor = z.infer<typeof DecisionFactorSchema>;
export type DecisionNode = z.infer<typeof DecisionNodeSchema>;
export type DecisionGraph = z.infer<typeof DecisionGraphSchema>;
export type AnalyzeDecisionRequest = z.infer<typeof AnalyzeDecisionRequestSchema>;
export type AnalyzeDecisionResponse = z.infer<typeof AnalyzeDecisionResponseSchema>;
export type ExpandNodeRequest = z.infer<typeof ExpandNodeRequestSchema>;
export type ExpandNodeResponse = z.infer<typeof ExpandNodeResponseSchema>;
