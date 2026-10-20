import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalDemo, normalizeAnalysis } from "./decision-service.js";

test("preserves explicit alternatives as keywords and first branches", () => {
  const result = buildLocalDemo("android or ios");
  assert.deepEqual(result.keywords, ["Android", "iOS"]);
  assert.equal(result.graph.title, "Android or iOS?");
  assert.deepEqual(
    result.graph.nodes.filter((node) => node.id !== "root").map((node) => node.label),
    ["Android", "iOS"],
  );
});

test("preserves alternatives embedded in a longer decision prompt", () => {
  const input = "Should I build my portfolio app for Android or iOS first?";
  const raw = buildLocalDemo("Which mobile platform should I explore?");
  const result = normalizeAnalysis(input, raw);

  assert.deepEqual(result.keywords, ["Android", "iOS"]);
  assert.equal(result.graph.title, "Android or iOS?");
  assert.deepEqual(
    result.graph.nodes.filter((node) => node.id !== "root").map((node) => node.label),
    ["Android", "iOS"],
  );
});

test("never substitutes generic abstract keywords", () => {
  const input = "Should I move abroad or stay near family?";
  const result = buildLocalDemo(input);
  for (const keyword of result.keywords) {
    assert.ok(input.toLowerCase().includes(keyword.toLowerCase()));
  }
});

test("repairs an AI graph that declares a missing root", () => {
  const raw = buildLocalDemo("android or ios");
  raw.graph.rootNodeId = "missing-root";
  raw.graph.nodes = raw.graph.nodes.filter((node) => node.id !== "root");
  raw.graph.edges = [{ id: "bad-edge", from: "android", to: "ios" }];

  const repaired = normalizeAnalysis("android or ios", raw);
  assert.equal(repaired.graph.rootNodeId, "root");
  assert.deepEqual(repaired.keywords, ["Android", "iOS"]);
  assert.deepEqual(
    repaired.graph.edges.map((edge) => [edge.from, edge.to]),
    [["root", "android"], ["root", "ios"]],
  );
});
