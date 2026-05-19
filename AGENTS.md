# Agent guide — InvestAI monorepo

Read this first. Humans should start at [README.md](./README.md).

**Canonical behavior reference:** [docs/HOW_IT_WORKS_NOW.md](./docs/HOW_IT_WORKS_NOW.md)  
**Today's changes:** [docs/DEV_LOG_2026-05-20.md](./docs/DEV_LOG_2026-05-20.md)  
**Prompt A/B study:** [docs/PROMPT_AB_TESTING.md](./docs/PROMPT_AB_TESTING.md)  
**Prompt engineering:** [docs/PROMPT_ENGINEERING.md](./docs/PROMPT_ENGINEERING.md)  
**System scope:** [docs/PROJECT_SCOPE.md](./docs/PROJECT_SCOPE.md)

## What this app does

Financial dashboard: stock quotes and charts (**Tiingo** in live mode), mock or live news, AI insights & predictions (**OpenRouter**), portfolio in Firestore. **SPA frontend** talks to **Express backend**; secrets stay server-side.

## Repo map (30 seconds)

| Path | Role |
|------|------|
| `apps/frontend/` | React + Vite UI — **only place with `views/`** |
| `apps/backend/` | REST API — routes → controllers → services (JSON, no views) |
| `packages/shared/` | Shared TypeScript types |
| `packages/prompts/` | **Versioned LLM prompt registry** (quote/chart/news/insights/prediction) |
| `docs/HOW_IT_WORKS_NOW.md` | **How it works now** (Tiingo, strict live, errors) |
| `docs/PROJECT_SCOPE.md` | **Full capabilities** — golden/Yahoo ground truth, RAG, eval UI proof, predictions |
| `docs/PROMPT_ENGINEERING.md` | **Prompt versions, RAG, eval iteration**; chart batching case study (per-symbol vs bulk) |
| `docs/DEV_LOG_2026-05-19.md` | Dev log — `@investai/prompts`, chart RAG on jobs |
| `docs/DEV_LOG_2026-05-18.md` | Dev log — agent charts-only, dual eval tabs, usage limits |
| `docs/AGENT_EVALS.md` | **Eval dashboards** (estimate, chart, prompt — timeline UI, storage) |
| `docs/DEV_LOG_2026-05-16.md` | Detailed dev log for 16 May 2026 |
| `docs/CODEBASE_MAP.md` | File-by-file index |
| `.env` (repo root) | **All backend secrets** |

## Commands

```bash
npm install
cp .env.example .env   # TIINGO_API_TOKEN + OPENROUTER_API_KEY
npm run dev            # frontend :5173 + backend :3001
npm test               # backend vitest + QA (mocked)
npm run build
```

Verify: `curl http://localhost:3001/api/health` → `data.env.missing` should be `[]` for full live+AI.

## Environment (backend)

| Variable | Required | Purpose |
|----------|----------|---------|
| `TIINGO_API_TOKEN` | **Live mode** | Tiingo EOD + news |
| `OPENROUTER_API_KEY` | **AI in live** | OpenRouter (`sk-or-...`) |
| `OPENROUTER_MODEL_PRIMARY` | No | Default: `deepseek/deepseek-chat-v3-0324` |
| `OPENROUTER_MODEL_FALLBACK` | No | Default: `qwen/qwen3.5-flash-02-23` |
| `MARKET_DATA_MODE` | No | Default `live` or `mock` |
| `MARKET_CACHE_TTL_HOURS` | No | Default 24 (once/day Tiingo usage) |
| `TIINGO_CHART_ON_DEMAND` | No | Default `false` — charts from bulk preload |
| `FIREBASE_*` | No | Portfolio + AI cache |
| `VITE_API_URL` | No | Empty in dev = Vite proxy |

**Not used:** Yahoo, Finnhub, Alpha Vantage, Gemini.

## API routes

| Method | Path | Module |
|--------|------|--------|
| GET | `/api/health` | health |
| GET/PUT | `/api/market/settings` | market (mode toggle) |
| GET | `/api/market/stocks` | market (`?refresh=1`) |
| GET | `/api/market/news` | market |
| GET | `/api/market/stocks/:symbol/timeseries` | market |
| GET | `/api/agent-scrape/prompts` | agent-scrape (prompt catalog + latest versions) |
| GET/POST | `/api/agent-scrape/golden`, `/eval` | agent-scrape (static regression golden) |
| GET | `/api/agent-scrape/usage-limits` | agent-scrape (`agent-run` + `prompt-test` buckets) |
| GET/POST | `/api/agent-scrape/eval/prompt` | agent-scrape (3-tier vs Yahoo golden) |
| POST | `/api/agent-scrape/eval/prompt/test` | Direct 30-day test + API summary |
| GET | `/api/agent-scrape/eval/prompt/cooldown` | Prompt-test cooldown only |
| GET | `/api/ai/insights` | ai (`?refresh=1`, returns `meta`) |
| POST | `/api/ai/stocks/:symbol/prediction` | ai |
| GET/PUT | `/api/portfolio` | portfolio |

## Market modes

| Mode | Source |
|------|--------|
| **mock** | `mockData.ts` catalog |
| **live** | Tiingo only — **no mock fallback** on failure (503 + error codes) |
| **agent** | 30-day LLM chart jobs; quotes/news from `quoteDataMode` (live/mock) — see [PROJECT_SCOPE.md](./docs/PROJECT_SCOPE.md) |

Toggle in header or `PUT /api/market/settings` with `{ "dataMode", "quoteDataMode" }`.

## Error codes (UI: `StatusBanner`)

Market: `MARKET_LIVE_UNAVAILABLE`, `MARKET_NEWS_FORBIDDEN`, `MARKET_NEWS_UNAVAILABLE`, `MARKET_CHART_NOT_PRELOADED`  
AI: `AI_NOT_CONFIGURED`, `AI_INVALID_RESPONSE`, `AI_GENERATION_FAILED`, `AI_INSUFFICIENT_MARKET_DATA`

## Frontend modules

| Module | Controller | Service |
|--------|------------|---------|
| `market` | `MarketDataProvider` | `marketApi` |
| `dashboard` | `useDashboardChart` | `dashboardApi` |
| `ai-insights` | `AIInsightsProvider` | `aiApi` |
| `portfolio` | `PortfolioProvider` | `portfolioApi` |
| `shared` | — | `StatusBanner` |

Entry: `apps/frontend/App.tsx`.

## Backend modules

| Module | Key files |
|--------|-----------|
| `market` | `marketService.ts`, `tiingoProvider.ts` |
| `ai` | `aiService.ts`, `insightsCacheService.ts`, `insightsValidation.ts` |
| `portfolio` | `portfolioService.ts` |

## Conventions

1. **Views = frontend only**
2. **No `fetch` in views** — use `*Api.ts`
3. **Types** in `packages/shared` — rebuild after changes
4. **Strict live** — never serve mock market data when mode is live
5. **Tests** — mock services in `api.qa.test.ts`

Full details: [docs/HOW_IT_WORKS_NOW.md](./docs/HOW_IT_WORKS_NOW.md).
