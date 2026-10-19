import { AnalyzeDecisionResponseSchema, type AnalyzeDecisionRequest } from "@maybe/contracts";
import { z } from "zod";

type LMStudioResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export async function analyzeWithLMStudio(input: AnalyzeDecisionRequest) {
  const endpoint = process.env.LMSTUDIO_URL ?? "http://127.0.0.1:1234";
  const model = process.env.LMSTUDIO_MODEL ?? "google/gemma-4-e2b";
  const schema = z.toJSONSchema(AnalyzeDecisionResponseSchema);

  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.LMSTUDIO_API_TOKEN
        ? { authorization: `Bearer ${process.env.LMSTUDIO_API_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: [
            "You are the scenario modeller for may.be.",
            "Model plausible paths; never claim to predict the future.",
            "Separate user facts, evidence, assumptions, and human unknowns.",
            "Create 2 to 6 materially different first branches.",
            "A human unknown must set needsHumanInput=true.",
            "Use short branch labels that fit inside a mobile node.",
            "Every keyword must be an exact contiguous phrase copied from the user's input; never replace their words with abstract themes.",
            "When the user gives explicit alternatives such as A or B, the root and first branches must preserve A and B.",
          ].join("\n"),
        },
        { role: "user", content: input.input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "maybe_decision_analysis",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LM Studio request failed with ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as LMStudioResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("LM Studio returned no structured content");
  return AnalyzeDecisionResponseSchema.parse(JSON.parse(content));
}
