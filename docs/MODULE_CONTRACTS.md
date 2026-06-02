# Module boundaries & contracts

Canonical rules for how InvestAI modules interact. Agents and humans should follow this before adding imports or new pipelines.

## Module map

| Module | Owns | Must not own |
|--------|------|----------------|
| `packages/shared` | Types, contract constants, shared math | API calls, prompts |
| `packages/prompts` | Prompt templates & registry | Market fetch, job state |
| `apps/backend/.../market` | Yahoo live fetch, cache, mock quotes, news bundle | LLM scrape jobs |
| `apps/backend/.../agent-scrape` | Agent jobs, eval persistence, RAG index | Direct Yahoo bulk (use market APIs) |
| `apps/backend/.../prompt-ab` (frontend) | A/B UI | Backend experiment logic |
| `apps/backend/src/workflows` | **Pipeline specs** (step order, labels) | Step implementation |
| `apps/backend/src/contracts` | Runtime guards, import rules | Business logic |
| `apps/backend/src/data/symbolCatalog` | Symbol list & **metadata** (no prices) | Live prices |
| `apps/backend/src/data/demoNewsCatalog` | Demo news fixtures | Live prices |
| `apps/backend/src/data/mockMarketData` | Static mock prices (re-export) | Live/agent paths |

## Data contracts

### Symbol catalog vs mock market data

- **`symbolCatalog`** — symbol universe, names, sectors, P/E, market cap. Safe for agent symbol lists and RAG text.
- **`mockMarketData`** — static prices and demo news. **Only** used when `dataMode === 'mock'` via `mockQuoteProvider` or explicit demo news paths.

### Live mode

- Quotes & charts: **`yahoo`** only (`MarketLiveProvider = 'yahoo'`).
- News in live mode: **demo catalog** until a live news provider exists (documented in API warnings).
- **`mock-catalog` provider** must never appear on live/agent quote responses (enforced at runtime).

### Agent mode

- Table quotes: from **quote source** (`live` or `mock`) — not from chart job.
- 30-day overlay: **`chart-scrape`** LLM (`openrouter-agent`), not Yahoo download during the job.
- Pipeline spec: `apps/backend/src/workflows/agent-chart.pipeline.ts`.

### Prompt A/B

- **`quote-scrape`** only; ground truth via market cache or Yahoo.
- Pipeline spec: `apps/backend/src/workflows/prompt-ab.pipeline.ts`.

## Import rules (enforced by test)

| Module | Allowed to import `mockMarketData` / `mockData` |
|--------|--------------------------------------------------|
| `mockQuoteProvider.ts` | Yes |
| `marketService.ts` | Yes (mock branches only) |
| `symbolCatalog.ts` | No (metadata only) |
| `ragService.ts` | No — use `symbolCatalog` + `demoNewsCatalog` |
| `agentScrapeService.ts` | No — use `symbolCatalog` |
| Everything else | No |

Run: `npm test` (includes `importBoundaries.test.ts`).

## Runtime guards

- `assertLiveQuoteProvider(provider)` — live/agent quote paths.
- `assertDataModeAllowsMock(mode)` — before serving mock catalog prices.

## Workflows (typed specs, not YAML yet)

Step lists live in `apps/backend/src/workflows/*.pipeline.ts`. Implementation stays in services; pipelines are the **contract** for order and naming. When changing a pipeline, update the `.pipeline.ts` file first, then the service.

## Future (optional)

- YAML runner if pipelines stabilize.
- XState if job cancel/parallel states grow beyond linear `steps[]`.
