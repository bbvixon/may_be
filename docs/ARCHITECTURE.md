# may.be architecture

## Product contract

may.be does not predict a future. It creates an editable graph of plausible paths from four explicitly different sources:

1. `user_fact` — supplied by the person.
2. `evidence` — retrieved from a named, current source.
3. `assumption` — modelled and editable.
4. `human_unknown` — a value question the model must return to the person.

The interface should show this distinction without turning into a dashboard. The graph is the product; prose supports it.

## Repository shape

```text
apps/
  web/          React/Vite mobile-first client and cinematic SVG renderer
  api/          Fastify API, orchestration, provider adapters
packages/
  contracts/    Shared Zod request, response, factor, and graph schemas
docs/           Product and architecture decisions
```

The existing root HTML prototype stays intact as a visual reference. Its complete v16 cinematic sequence is now migrated into `apps/web`, and a hash-verified frozen copy lives in `backups/v16`.

## First vertical slice

```text
speech/text
   ↓
POST /v1/decisions/analyze
   ↓
extract keywords + frame the decision + classify factors
   ↓
validated DecisionGraph
   ↓
custom SVG renderer
   ↓
POST /v1/decisions/expand when a path is chosen
```

The backend returns meaning, not animation instructions. The frontend owns timing, camera motion, fades, and branch choreography.

## Local AI

Development defaults to a deterministic mock so UI work is reproducible. `MAYBE_AI_PROVIDER=lmstudio` uses the recommended local LM Studio adapter; `ollama` remains supported. Both adapters send the shared graph schema as the structured-output format and validate the response again before it reaches the frontend.

Suggested local environment:

```text
MAYBE_AI_PROVIDER=lmstudio
LMSTUDIO_URL=http://127.0.0.1:1234
LMSTUDIO_MODEL=google/gemma-4-e2b
```

## Deliberate non-goals for the first slice

- No autonomous multi-agent system.
- No vector database before there is evidence worth retrieving.
- No invented probabilities.
- No dashboard.
- No model-owned animation timing.

Next slices: persistent decisions, citations/evidence retrieval, editable assumptions with downstream recalculation, and the `Your paths` constellation view.
