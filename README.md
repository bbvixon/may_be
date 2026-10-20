# may.be

Mobile-first decision exploration app. The production workspace now uses React, TypeScript, Fastify, shared Zod contracts, and an optional local Ollama provider.

## Production workspace

Install once, then start the API and web client in separate terminals:

```powershell
npm install
npm run dev:api
npm run dev:web
```

Open `http://127.0.0.1:4173`. The API listens on `http://127.0.0.1:8787`.

The local API defaults to Ollama with `qwen3:4b-instruct`. Make sure Ollama is running and the model is installed:

```powershell
ollama pull qwen3:4b-instruct
ollama ls
```

Then run `npm run dev:api` and `npm run dev:web` in separate terminals. The first decision can take longer while the model is loaded; later branch expansions reuse the warm model.

To use LM Studio + Gemma 4 E2B instead, start LM Studio's local server, load the model, then configure:

```powershell
$env:MAYBE_AI_PROVIDER="lmstudio"
$env:LMSTUDIO_URL="http://127.0.0.1:1234"
$env:LMSTUDIO_MODEL="google/gemma-4-e2b"
npm run dev:api
```

The hosted Render service explicitly sets `MAYBE_AI_PROVIDER=mock`; these local Ollama settings are not exposed publicly.

## Voice input

The web client now uses the browser speech-recognition API and writes interim/final transcripts into the text field before analysis starts. Unsupported preview browsers show an explicit fallback instead of pretending to record. A later native mobile build should use the platform speech API or a dedicated local ASR service.

## Workspace

- `apps/web`: React mobile-first client and SVG branch renderer
- `apps/api`: Fastify decision analysis and expansion API
- `packages/contracts`: Zod schemas shared across both sides
- `docs/ARCHITECTURE.md`: product contract and architectural boundaries

## Visual migration

The v16 cinematic sequence now runs in the React client and is connected to the typed API. The original buildless prototype remains at the repository root and a frozen, hash-verified copy lives in `backups/v16`.

Run the original root prototype with:

```powershell
python -m http.server 4173
```

## Included

- `DESIGN_SYSTEM.md`: product, visual, language, and motion rules
- `index.html`, `styles.css`, `app.js`: v16 visual reference prototype
- `backups/v16`: recoverable v16 snapshot and SHA-256 manifest

may.be models plausible paths from explicit facts, evidence, assumptions, and human unknowns. It does not claim to predict outcomes.

## Portfolio deployment

The repository includes a root `render.yaml` for a single Render web service. The production Fastify process serves both the compiled React application and the `/v1` API from one origin.

The hosted portfolio build uses the deterministic mock provider:

```text
MAYBE_AI_PROVIDER=mock
```

Deploy through the Render Blueprint page after pushing `main`:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/bbvixon/may_be
```

Ollama and LM Studio remain local-development providers. Do not expose their native ports publicly; for a private live demonstration, tunnel the may.be web application instead.
