# AutoICD TypeScript SDK

Public SDK for **AutoICD API** (autoicdapi.com). Published as `autoicd` on npm.
GitHub: `github.com/fcggamou/autoicd-js`

## Quick Reference

```bash
npm run build        # tsup → dist/ (CJS + ESM + .d.ts)
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest (watch mode)
```

## Architecture

```
src/
├── index.ts      — Public exports (re-exports client, types, errors)
├── client.ts     — AutoICD class + ICD10/ICD11 sub-resources + HTTP internals
├── types.ts      — All request/response interfaces
└── errors.ts     — AutoICDError hierarchy (401, 404, 429)
tests/
└── client.test.ts — Unit tests with mocked fetch
```

- **Zero dependencies** — uses native `fetch`, `AbortController`, `URLSearchParams`
- Dual format: CJS (`dist/index.js`) + ESM (`dist/index.mjs`) via tsup
- Target: ES2022, Node 18+, Deno, Bun, edge runtimes

## API Surface

```ts
const client = new AutoICD({ apiKey: "sk_..." });

client.code(text, options?)       // POST /api/v1/code — clinical text → ICD-10 codes
client.anonymize(text)            // POST /api/v1/anonymize — PHI de-identification
client.icd10.search(query, opts?) // GET  /api/v1/icd10/codes/search — search ICD-10 codes
client.icd10.get(code)            // GET  /api/v1/icd10/codes/:code — code details
client.lastRateLimit              // Rate limit info from last response
```

## Conventions

- Options use **camelCase** in TS, converted to **snake_case** in request bodies (e.g., `topK` → `top_k`)
- API responses use **snake_case** — types mirror the raw API shapes, no client-side transformation
- Error classes: `AutoICDError` (base), `AuthenticationError` (401), `NotFoundError` (404), `RateLimitError` (429)
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- API keys start with `sk_`
- Base URL defaults to `https://autoicdapi.com`, no trailing slash
- All HTTP goes through the private `request()` method — single place for auth, timeout, error handling, rate limit parsing
- `undefined` options are stripped from request bodies before sending

## This Is a Marketing Asset

The README, package.json description, and keywords are **SEO-optimized** to drive traffic to autoicdapi.com. When editing:

- Keep the README rich with examples, use cases, and links back to autoicdapi.com
- Maintain keyword density in package.json (icd-10, medical-coding, clinical-nlp, etc.)
- Use real-looking clinical examples in code samples (they appear in search results)
- Brand name is **AutoICD API** — always capitalize correctly

## Git Identity

This is a **public repo**. All commits MUST be authored by the AutoICD brand — never use personal or work identities.

Before committing, always use repo-local git config:
```bash
git -C /Users/fede/repos/autoicd/sdk-ts commit --author="AutoICD <info@autoicdapi.com>"
```

If creating commits via the CLI, always pass `--author="AutoICD <info@autoicdapi.com>"`.

## Sync with API

The SDK calls the Next.js API routes at `api/src/app/api/v1/`. Any changes to API request/response shapes must be reflected here:

- Route changes → update paths in `client.ts`
- Response shape changes → update interfaces in `types.ts`
- New endpoints → add method to `AutoICD` or `Codes` class, export types from `index.ts`
- Test against live API or local dev server (port 3000) with `baseURL: "http://localhost:3000"`
