# Codebase map — every important file

Fast lookup for humans and coding agents. Paths are relative to repo root.

---

## Root

| File | Purpose |
|------|---------|
| `package.json` | npm workspaces; scripts: `dev`, `build`, `test` |
| `.env` | **Runtime secrets** (gitignored) — copy from `.env.example` |
| `.env.example` | Template for all env vars |
| `AGENTS.md` | **Start here for agents** — commands, routes, conventions |
| `README.md` | Human quick start |
| `FIREBASE_SETUP.md` | Firestore setup |
| `docs/ARCHITECTURE.md` | MVC split, diagrams, env table |
| `docs/HOW_IT_WORKS_NOW.md` | **Current behavior** — Tiingo, strict live, caching, error codes (agents start here) |
| `docs/DEV_LOG_2026-05-16.md` | Detailed dev log for 16 May 2026 session |
| `docs/FEATURE_MODULES.md` | How to add modules |
| `docs/CODEBASE_MAP.md` | This file |

---

## `packages/shared/`

| File | Purpose |
|------|---------|
| `src/types.ts` | `StockQuote`, `AIInsights`, `HealthStatus`, `Holding`, etc. |
| `src/index.ts` | Re-exports types |

---

## `apps/backend/src/`

### Core

| File | Purpose |
|------|---------|
| `index.ts` | Starts server; logs env warnings |
| `app.ts` | `createApp()` — CORS, JSON, routes, error handler |
| `config/env.ts` | Loads `.env`; OpenRouter models; `validateEnv()` |
| `config/firebase.ts` | Firestore client singleton |
| `routes/index.ts` | Mounts module routers under `/api` |
| `middleware/errorHandler.ts` | `AppError` + JSON errors |

### Utils (shared backend helpers)

| File | Purpose |
|------|---------|
| `utils/aiClient.ts` | OpenRouter primary → fallback; JSON parse |
| `utils/cache.ts` | In-memory TTL cache (Yahoo quotes) |
| `utils/response.ts` | `sendSuccess` / `sendError` |
| `utils/asyncHandler.ts` | Async Express wrapper |
| `utils/formatVolume.ts` | Format share volume strings |

### Data

| File | Purpose |
|------|---------|
| `data/mockData.ts` | ~85 stock symbols + mock news articles |

### `modules/health/`

| File | Purpose |
|------|---------|
| `controllers/healthController.ts` | `GET /api/health` — uptime, env validation |
| `routes/healthRoutes.ts` | Routes for health + `/api/qa/health` |
| `__tests__/health.test.ts` | Health endpoint tests |

### `modules/market/`

| File | Purpose |
|------|---------|
| `services/marketService.ts` | Yahoo quotes (batch), news, time series |
| `controllers/marketController.ts` | HTTP handlers for market endpoints |
| `routes/marketRoutes.ts` | `/api/market/*` |

### `modules/ai/`

| File | Purpose |
|------|---------|
| `services/aiService.ts` | Build prompts; insights + predictions; mock fallbacks |
| `services/insightsCacheService.ts` | Firestore cache 15 min for insights |
| `services/predictionCacheService.ts` | Firestore cache 24 h per symbol |
| `controllers/aiController.ts` | `/api/ai/insights`, prediction POST |
| `routes/aiRoutes.ts` | AI routes |

### `modules/portfolio/`

| File | Purpose |
|------|---------|
| `services/portfolioService.ts` | Firestore read/write holdings |
| `controllers/portfolioController.ts` | GET/PUT portfolio |
| `routes/portfolioRoutes.ts` | `/api/portfolio` |

### Tests

| File | Purpose |
|------|---------|
| `__tests__/qa/api.qa.test.ts` | QA tests (mocked services) |
| `test/setup.ts` | Vitest env defaults |

---

## `apps/frontend/`

### Core

| File | Purpose |
|------|---------|
| `main.tsx` | React entry |
| `App.tsx` | Shell: nav, providers, view switcher |
| `index.html` | HTML shell |
| `vite.config.ts` | Dev server + `/api` proxy |
| `shared/api/http.ts` | Base `fetch` + `ApiResponse` unwrap |

### `modules/market/` (data layer)

| File | Purpose |
|------|---------|
| `controllers/MarketDataProvider.tsx` | Global stocks, news, AI insights state |
| `services/marketApi.ts` | `getStocks`, `getNews` |
| `index.ts` | Public exports |

### `modules/dashboard/`

| File | Purpose |
|------|---------|
| `views/Dashboard.tsx` | **View** — charts, stock grid, prediction UI |
| `controllers/useDashboardChart.ts` | Chart + prediction state/logic |
| `services/dashboardApi.ts` | Time series + prediction API |
| `index.ts` | Exports `Dashboard` |

### `modules/stock-comparison/`

| File | Purpose |
|------|---------|
| `views/StockComparison.tsx` | **View** — sortable comparison table |
| `index.ts` | Exports `StockComparison` |

### `modules/news/`

| File | Purpose |
|------|---------|
| `views/NewsFeed.tsx` | **View** — news list + modal |
| `controllers/useNewsFeed.ts` | Category filter state |
| `index.ts` | Exports `NewsFeed` |

### `modules/ai-insights/`

| File | Purpose |
|------|---------|
| `views/AIInsights.tsx` | **View** — recommendations, risks, trends |
| `services/aiApi.ts` | `getInsights` |
| `index.ts` | Exports `AIInsights` |

### `modules/portfolio/`

| File | Purpose |
|------|---------|
| `views/Portfolio.tsx` | **View** — holdings, watchlist UI |
| `controllers/PortfolioProvider.tsx` | Holdings CRUD + API sync |
| `services/portfolioApi.ts` | `getPortfolio`, `savePortfolio` |
| `index.ts` | Exports |

### Shared UI (not feature-specific)

| Path | Purpose |
|------|---------|
| `components/ui/*` | shadcn/Radix primitives (Button, Card, …) |
| `components/figma/ImageWithFallback.tsx` | Image fallback helper |
| `styles/index.css` | Tailwind entry |
| `styles/globals.css` | CSS variables / theme |

### Legacy (avoid — use `modules/`)

| Path | Note |
|------|------|
| `contexts/DataContext.tsx` | **Deprecated** — use `@/modules/market` |
| `contexts/PortfolioContext.tsx` | **Deprecated** — use `@/modules/portfolio` |

---

## Data flow cheat sheet

1. User opens app → `MarketDataProvider` loads stocks + news → then AI insights.
2. Dashboard chart → `dashboardApi.getTimeSeries` → backend `marketService`.
3. Prediction button → `dashboardApi.getPrediction` → backend `ai` module.
4. Portfolio changes → `portfolioApi.savePortfolio` → Firestore via backend.

---

## Branch note

Active refactor branch: `refactor/modular-monolith`.
