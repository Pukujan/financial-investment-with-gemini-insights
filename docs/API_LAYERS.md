# API layers — how calls are organized

Quick reference for humans and coding agents.

## Layer diagram

```mermaid
flowchart TB
  subgraph fe_views [Frontend Views]
    V1[Dashboard]
    V2[NewsFeed]
    V3[AIInsights]
    V4[Portfolio]
  end

  subgraph fe_ctrl [Frontend Controllers]
    C1[useDashboardChart]
    C2[MarketDataProvider]
    C3[AIInsightsProvider]
    C4[PortfolioProvider]
    C5[useNewsFeed]
  end

  subgraph fe_api [Frontend API services]
    A1[marketApi]
    A2[dashboardApi]
    A3[aiApi]
    A4[portfolioApi]
    HTTP[shared/api/http.ts]
  end

  subgraph be_routes [Backend Routes]
    R1["/api/market/*"]
    R2["/api/ai/*"]
    R3["/api/portfolio"]
  end

  subgraph be_svc [Backend Services]
    S1[marketService]
    S2[aiService + caches]
    S3[portfolioService]
    YF[yahooFetch]
    OR[aiClient]
  end

  V1 --> C1 --> A2 --> HTTP
  V2 --> C2
  V3 --> C3 --> A3 --> HTTP
  V4 --> C4 --> A4 --> HTTP
  C2 --> A1 --> HTTP
  C1 --> C2

  HTTP --> R1 & R2 & R3
  R1 --> S1 --> YF
  R2 --> S2 --> OR
  R3 --> S3
```

## Rule: one `fetch` entry point per app

| App | Only here |
|-----|-----------|
| Frontend | `shared/api/http.ts` |
| Backend (HTTP out) | `utils/yahooFetch.ts`, `utils/aiClient.ts` |
| Backend (HTTP in) | `modules/*/routes` → `controllers` → `services` |

Views and controllers must **not** call `fetch` directly.

---

## Frontend API services (by feature)

| Service file | Endpoints | Used by |
|--------------|-----------|---------|
| `modules/market/services/marketApi.ts` | `GET /api/market/stocks`, `GET /api/market/news` | `MarketDataProvider` |
| `modules/dashboard/services/dashboardApi.ts` | `GET .../timeseries`, `POST .../prediction` | `useDashboardChart` |
| `modules/ai-insights/services/aiApi.ts` | `GET /api/ai/insights` | `AIInsightsProvider` |
| `modules/portfolio/services/portfolioApi.ts` | `GET/PUT /api/portfolio` | `PortfolioProvider` |

Import pattern:

```ts
import { marketApi } from '@/modules/market';
import { http } from '@/shared/api/http'; // low-level only inside *Api.ts
```

---

## Backend services (by feature)

| Service | External systems | Called from |
|---------|------------------|-------------|
| `market/marketService.ts` | Yahoo (via `yahooFetch`) | `marketController` |
| `ai/aiService.ts` | OpenRouter (via `aiClient`) | insight + prediction caches |
| `ai/insightsCacheService.ts` | Firestore | `aiController.getInsights` |
| `ai/predictionCacheService.ts` | Firestore | `aiController.getPrediction` |
| `portfolio/portfolioService.ts` | Firestore | `portfolioController` |

---

## Known cross-module links (orchestration)

These are intentional “compose multiple domains” paths:

| From | Imports | Why |
|------|---------|-----|
| `ai/aiController` | `marketService` | `/api/ai/insights` needs live stocks + news server-side |
| `dashboardApi` (FE) | routes under `/api/market` and `/api/ai` | Dashboard spans chart + prediction |

Prefer adding a dedicated backend orchestrator (e.g. `insightsOrchestrator.ts`) if this grows.

---

## Adding a new API call

### Frontend

1. Add method to the feature’s `services/*Api.ts` using `http<T>()`.
2. Call it from that feature’s `controllers/` hook or provider.
3. Use data in `views/`.
4. Export from `modules/<feature>/index.ts`.

### Backend

1. Add logic in `modules/<feature>/services/`.
2. Add handler in `controllers/`.
3. Add route in `routes/`.
4. Register in `src/routes/index.ts` if new module.
5. Add QA test in `__tests__/qa/`.

---

## Modularity scorecard

| Check | Status |
|-------|--------|
| Single HTTP client (FE) | Yes — `http.ts` |
| Per-feature `*Api.ts` (FE) | Yes |
| Views avoid `fetch` | Yes |
| Backend routes → controllers → services | Yes |
| External APIs in utils | Yes — Yahoo, OpenRouter |
| Shared types | Yes — `@investai/shared` |
| AI state owned by ai-insights module | Yes — `AIInsightsProvider` |
| Market state owned by market module | Yes — `MarketDataProvider` |
| Cross-module provider imports | Minimized |
