# may.be

Mobile-first decision exploration app. The production workspace now uses React, TypeScript, Fastify, shared Zod contracts, and an optional local Ollama provider.

## Production workspace

Install once, then start the API and web client in separate terminals:

```powershell
npm install
npm run dev:api
npm run dev:web
```

Open `http://127.0.0.1:4174`. The API listens on `http://127.0.0.1:8787`.

The API defaults to a deterministic mock. To use a local model, configure:

```powershell
$env:MAYBE_AI_PROVIDER="ollama"
$env:OLLAMA_MODEL="qwen3:8b"
npm run dev:api
```

## Workspace

- `apps/web`: React mobile-first client and SVG branch renderer
- `apps/api`: Fastify decision analysis and expansion API
- `packages/contracts`: Zod schemas shared across both sides
- `docs/ARCHITECTURE.md`: product contract and architectural boundaries

## Visual prototype

The original buildless prototype remains at the repository root while its complete cinematic sequence is migrated into React. Run it with:

```powershell
python -m http.server 4173
```

## Included

- `DESIGN_SYSTEM.md`: product, visual, language, and motion rules
- `index.html`, `styles.css`, `app.js`: v16 visual reference prototype

may.be models plausible paths from explicit facts, evidence, assumptions, and human unknowns. It does not claim to predict outcomes.
