import { useMutation } from "@tanstack/react-query";
import { analyzeDecision } from "../../lib/api";

export function useDecisionAnalysis() {
  return useMutation({ mutationFn: analyzeDecision });
}
