# Agent scrape evals

InvestAI records **eval analytics** for agent-scraped data: automatic logs after each scrape job, plus on-demand **prompt experiments** (three LLM tiers vs Yahoo golden). These are **not** market quote caches.

**UI entry points:** App header → **Estimate eval** | **Chart eval** | **Prompt eval**

**Product scope:** [PROJECT_SCOPE.md](./PROJECT_SCOPE.md) — golden dataset, RAG, tier comparison, improvement timeline.

---

## What gets measured

| Dashboard | Question it answers | Golden reference |
|-----------|---------------------|------------------|
| **Estimate eval** | Did our **pre-scrape token/cost estimate** match **actual OpenRouter usage**? | Actual `usage` on the completed job |
| **Chart eval** | Do **agent quotes** align with **chart last closes** and with **Yahoo EOD** bars? | Synthetic/LLM series + optional Yahoo `1d` chart |
| **Prompt eval** | Do **three cost tiers** match **Yahoo EOD** with a given **prompt version** and optional **RAG**? | Yahoo fetched at experiment time + improvement vs previous run |

---

## Where data is stored (triple layer)

Eval logs use **browser localStorage + server disk + Firestore** (when Firebase is configured). Market quote caches remain separate (`marketBulkCache`, `agentBulkCache`, etc.).

```mermaid
flowchart TB
  subgraph job [Agent scrape job completes]
    J[AgentScrapeJob]
    J --> EE[estimateEval record]
    J --> CE[chartEval record]
  end

  subgraph server [Backend persistence]
    EE --> DISK1[".data/estimate-eval-history.json"]
    CE --> DISK2[".data/chart-eval-history.json"]
    PE --> DISK3[".data/prompt-eval-history.json"]
    EE --> FS1[(Firestore estimateEvalRuns)]
    CE --> FS2[(Firestore chartEvalRuns)]
    PE --> FS3[(Firestore promptEvalExperiments)]
    RAG --> FS4[(Firestore ragRetrievalLogs)]
    J --> MEM[In-memory job map last 10 jobs]
  end

  subgraph browser [Frontend persistence]
    EE --> LS1[localStorage estimate-eval-v1]
    CE --> LS2[localStorage chart-eval-v1]
    PE --> LS3[localStorage prompt-eval-v1]
    J --> LS4[localStorage agent-queue lastJob]
  end

  subgraph api [REST read path]
    DISK1 --> API1["GET /eval/estimates"]
    DISK2 --> API2["GET /eval/charts"]
    DISK3 --> API3["GET /eval/prompt"]
    FS1 --> API1
    FS2 --> API2
    FS3 --> API3
    MEM --> API1
    MEM --> API2
  end

  subgraph ui [Dashboards merge + sync]
    API1 --> MERGE1[merge + timeline UI]
    API2 --> MERGE2[merge + timeline UI]
    API3 --> MERGE3[merge + timeline UI]
    LS1 --> MERGE1
    LS2 --> MERGE2
    LS3 --> MERGE3
    LS1 --> SYNC1["POST /eval/estimates/sync"]
    LS2 --> SYNC2["POST /eval/charts/sync"]
    LS3 --> SYNC3["POST /eval/prompt/sync"]
    SYNC1 --> FS1
    SYNC2 --> FS2
    SYNC3 --> FS3
  end
```

| Store | Path / key | Survives Railway restart? |
|-------|------------|---------------------------|
| Estimate eval (server) | `apps/backend/.data/estimate-eval-history.json` | Yes (if disk persists) |
| Chart eval (server) | `apps/backend/.data/chart-eval-history.json` | Yes |
| Estimate eval (browser) | `investai-estimate-eval-v1` | Per browser only |
| Chart eval (browser) | `investai-chart-eval-v1` | Per browser only |
| Prompt eval (server) | `apps/backend/.data/prompt-eval-history.json` | Yes (if disk persists) |
| Prompt eval (browser) | `investai-prompt-eval-v1` | Per browser only |
| Completed job snapshot | `investai-agent-queue-v1` → `lastJob` | Per browser only |

**Firestore** is used for portfolio, AI insights cache, and **market/agent quote bulk** — not for eval history.

---

## Estimate eval — end-to-end flow

```mermaid
sequenceDiagram
  participant UI as Frontend Agent panel
  participant API as POST /api/agent-scrape/jobs
  participant Job as agentScrapeJobService
  participant OR as OpenRouter
  participant Eval as estimateEvalService
  participant Disk as .data/estimate-eval-history.json

  UI->>API: startJob tier, forceLive, scrapeCharts
  API->>Job: createAgentScrapeJob + runAgentScrapeJob
  Job->>Job: estimateAgentScrape → estimateSnapshot on job
  loop Quote batches
    Job->>OR: scrapeQuotesWithAgent
  end
  opt scrapeCharts
    Job->>OR: scrapeChartsWithAgent
  end
  Job->>OR: scrapeNewsWithAgent optional
  Job->>Job: job.usage = merged tokens + cost
  Job->>Eval: buildEstimateEvalFromJob(job)
  Eval->>Disk: recordEstimateEval
  Job-->>UI: poll GET /jobs/:id → estimateEval on job
  UI->>UI: persistEstimateEvalRecord localStorage
  UI->>UI: Estimate eval dashboard timeline
```

### Pre-run snapshot

Before quote batches run, the job stores `estimateSnapshot` from `estimateAgentScrape()`:

- Estimated prompt / completion / total tokens  
- Estimated USD cost for the selected tier  
- Whether quotes/news were expected to hit cache  

If estimation fails, the job still completes but **no estimate eval row** is produced (`buildEstimateEvalFromJob` returns `null` without snapshot).

### Accuracy ratings

| Rating | Rule |
|--------|------|
| `cached` | Actual tokens = 0 (fully cached load) |
| `excellent` | \|token delta %\| ≤ 10% |
| `good` | ≤ 25% |
| `fair` | ≤ 50% |
| `poor` | > 50% |
| `unknown` | Estimate total was 0 |

### UI: clickable timeline

1. Left: **Run timeline** — one row per `jobId` (newest first).  
2. Click a row → right panel shows **Estimate vs actual** table:  
   - Prompt / completion / total tokens (estimated, actual, delta, Δ%)  
   - Cost USD (same columns)

Shared types: `packages/shared/src/estimateEval.ts`  
Backend: `apps/backend/src/modules/agent-scrape/services/estimateEvalService.ts`  
Frontend: `apps/frontend/modules/market/views/EstimateEvalDashboard.tsx`

---

## Chart eval — end-to-end flow

```mermaid
sequenceDiagram
  participant Job as agentScrapeJobService
  participant Agent as Agent quotes + series
  participant Yahoo as yahooProvider
  participant Eval as chartEvalService
  participant Disk as .data/chart-eval-history.json

  Job->>Agent: scrape quotes → allQuotes
  Job->>Agent: timeSeriesFromQuote per symbol synthetic EOD
  opt scrapeCharts enabled
    Job->>Agent: scrapeChartsWithAgent → seriesLlm
  end
  loop Up to 8 symbols
    Job->>Yahoo: fetchYahooChartQuotes symbol
    Yahoo-->>Job: daily 1d bars EOD
  end
  Job->>Eval: buildChartEval job, quotes, seriesLlm, synthetic, liveSeries
  Eval->>Eval: per-symbol quote vs synth vs LLM + dailyVsLive
  Eval->>Disk: recordChartEval
```

### EOD price convention (Yahoo vs agent)

Both live (Yahoo) and agent synthetic series use **daily end-of-session close**, not open.

```mermaid
flowchart LR
  subgraph yahoo [Yahoo Finance interval 1d]
    Y1[Trading day N] --> Y2[open high low close]
    Y2 --> Y3[close = EOD for that session]
  end

  subgraph agent [Agent synthetic buildEodSeriesFromQuote]
    A1[Mon–Fri dates only] --> A2[Last bar close = agent quote price]
    A2 --> A3[Earlier bars drift around quote]
  end

  subgraph compare [Chart eval dailyVsLive]
    D[Match by date YYYY-MM-DD]
    D --> PCT["deviationPct = (agentClose - yahooClose) / yahooClose"]
  end

  yahoo --> compare
  agent --> compare
```

| Topic | Behavior |
|-------|----------|
| **Today's bar** | Yahoo’s latest `1d` bar is the **most recent trading session** (may update while US market is open). Agent last bar uses the **scraped quote** as that session’s close. |
| **Weekends** | Agent synthetic skips Sat/Sun; Yahoo returns trading days only. |
| **30-day vs 1-day** | Dashboard charts slice the same EOD series (3d / 7d / 30d). Eval reports **latest-session** deviation and **avg \|deviation\| per day** over ~30 trading days. |
| **LLM charts** | When “Scrape 30-day charts” is enabled, LLM OHLC is compared the same way; `dailyVsLive` uses LLM series when present. |

### Per-run metrics (symbol table)

| Column | Meaning |
|--------|---------|
| Quote | Agent-scraped “current” price |
| Synthetic last close | Last point of EOD synthetic series |
| Quote vs synth % | Alignment of quote to synthetic chart |
| LLM last close | Last point of LLM-scraped series (if enabled) |
| Avg \|agent − Yahoo\| / day | Mean absolute daily % vs Yahoo (up to 8 symbols) |

### UI: clickable timeline + charts

1. Left: **Run timeline** (mode, symbol count, avg deltas).  
2. Click → detail panel:  
   - Summary metrics table  
   - Symbol selector  
   - **Line chart:** Agent EOD vs Yahoo EOD by date  
   - **Bar chart:** Daily deviation % (agent − Yahoo)  

Runs **before** Yahoo reference was added show tables only (no day charts).

Shared types: `packages/shared/src/chartEval.ts`, `packages/shared/src/tradingDays.ts`  
Backend: `apps/backend/src/modules/agent-scrape/services/chartEvalService.ts`  
Frontend: `apps/frontend/modules/market/views/ChartEvalDashboard.tsx`

---

## API reference

| Method | Path | Response shape |
|--------|------|----------------|
| `GET` | `/api/agent-scrape/eval/estimates` | `{ records[], summary }` |
| `GET` | `/api/agent-scrape/eval/charts` | `{ records[], lastRecord }` |

Both merge **disk history** with **recent in-memory jobs** (same pattern).

---

## Skip cache / force fresh scrape

Eval quality depends on running a real scrape. Cache bypass options:

```mermaid
flowchart TD
  A[User action] --> B{Force live?}
  B -->|Yes| C[invalidateAgentScrapeCache + Firestore agent keys]
  C --> D[Live OpenRouter scrape]
  B -->|No| E{Refresh stocks?}
  E -->|refresh=1| C
  E -->|No| F[Memory → Firestore → return cache]
  D --> G[New estimateEval + chartEval rows]
```

| Action | Effect on eval |
|--------|----------------|
| Agent job **Force live** (`forceLive: true`) | Clears agent memory + agent Firestore caches; full scrape; new eval rows |
| Market **Refresh** (`?refresh=1`) | Clears market + agent caches; next load may create new bulk data |
| **Load from cache** | 0 tokens; estimate eval rating = `cached` |

---

## Code map

| Piece | Location |
|-------|----------|
| Build estimate eval from job | `packages/shared/src/estimateEval.ts` → `buildEstimateEvalFromJob` |
| Persist / load estimate history | `estimateEvalService.ts` |
| Build chart eval + daily vs live | `chartEvalService.ts` |
| EOD trading-day helpers | `packages/shared/src/tradingDays.ts` |
| Job orchestration | `agentScrapeJobService.ts` |
| Timeline UI component | `apps/frontend/modules/market/views/eval/EvalRunTimeline.tsx` |
| Estimate detail panel | `views/eval/EstimateEvalRunDetail.tsx` |
| Chart detail panel | `views/eval/ChartEvalRunDetail.tsx` |
| Prompt eval service | `promptEvalService.ts`, `ragService.ts` |
| Prompt eval UI | `PromptEvalDashboard.tsx`, `PromptEvalRunDetail.tsx`, `RagFlowPanel.tsx` |
| Tests | `chartEvalService.test.ts`, `evalHistoryApi.test.ts` |

---

## Prompt eval — end-to-end flow

```mermaid
sequenceDiagram
  participant UI as Prompt eval dashboard
  participant API as POST /eval/prompt
  participant Yahoo as Yahoo EOD
  participant RAG as ragService
  participant OR as OpenRouter x3 tiers
  participant Disk as prompt-eval-history.json

  UI->>API: promptVersion, ragEnabled
  API->>Yahoo: fetch golden closes
  opt RAG enabled
    API->>RAG: retrieveRagForSymbols
    RAG-->>API: contextBlock + chunk meta
  end
  loop each AI_COST_TIER
    API->>OR: scrapeQuotesWithAgent + goldenHint
    OR-->>API: quotes + usage
    API->>API: dailyVsLive vs Yahoo series
  end
  API->>API: improvement vs previous experiment
  API->>Disk: persist PromptEvalExperiment
  API-->>UI: record + timeline refresh
```

**UI:** Timeline lists prompt versions with RAG badge and deviation delta. Selecting a run opens golden vs three tiers, tier bar charts, EOD line chart, and **RAG flow** panel on one screen.

**Prompt registry:** `promptVersion` in the UI (e.g. `v-2026-05-19`) resolves to a template in `packages/prompts` (`quote-scrape` `2026-05-19`). Experiments store `promptSuite` with the resolved version. Catalog: `GET /api/agent-scrape/prompts`. See [PROMPT_ENGINEERING.md](./PROMPT_ENGINEERING.md).

**Chart / estimate eval:** These dashboards measure job outcomes; they do **not** version or edit prompts. To improve charts, bump `chart-scrape` in `@investai/prompts` and re-run Agent **Start**.

---

## Related docs

- [Prompt engineering](./PROMPT_ENGINEERING.md) — versioned templates, RAG, iteration workflow  
- [Project scope](./PROJECT_SCOPE.md) — goals, golden dataset, RAG, tiers  
- [Agent scrape mode](./AGENT_SCRAPE.md) — quotes, news, jobs  
- [Cache architecture](./CACHE.md) — market vs eval storage  
- [How it works now](./HOW_IT_WORKS_NOW.md) — live/mock/agent market modes  
