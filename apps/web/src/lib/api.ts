import {
  AnalyzeDecisionResponseSchema,
  ExpandNodeResponseSchema,
  type AnalyzeDecisionRequest,
  type ExpandNodeRequest,
} from "@maybe/contracts";

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`may.be API returned ${response.status}`);
  return response.json();
}

export async function analyzeDecision(request: AnalyzeDecisionRequest) {
  return AnalyzeDecisionResponseSchema.parse(
    await postJson("/v1/decisions/analyze", request),
  );
}

export async function expandNode(request: ExpandNodeRequest) {
  return ExpandNodeResponseSchema.parse(
    await postJson("/v1/decisions/expand", request),
  );
}
