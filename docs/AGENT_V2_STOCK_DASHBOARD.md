# Agent v2 — Stock Dashboard Prompt Split (v2)

Created: 2026-06-03 · Timezone: America/New_York

Three implementation modules for **Agent v2** mode only (`MarketDataMode: 'agent-v2'`):

| # | Prompt | Service |
|---|--------|---------|
| 1 | Yahoo 30-Day Stock Trend Analyzer | `apps/frontend/modules/stocks/services/stockTrendAnalysisService.ts` |
| 2 | Synthetic Demo Market News Generator | `apps/frontend/modules/stocks/services/demoMarketNewsGenerationService.ts` |
| 3 | 7-Day Prediction From Yahoo Trend + Synthetic Demo News | `apps/frontend/modules/stocks/services/sevenDayPredictionService.ts` |

Supporting:

- `demoMarketNewsCacheService.ts` — 1-day localStorage cache (`stock-demo-market-news:v2:{symbol}`)
- `getOrCreateDemoMarketNewsService.ts` — orchestrates trend → cache → 20 items

## Flow

```
Yahoo 30-day OHLCV (existing API)
  → analyzeThirtyDayTrend
  → generateDemoMarketNewsFromTrend (20 synthetic items)
  → cache 24h
  → Dashboard demo news panel
  → generateSevenDayPrediction (Get Prediction)
```

## Rules

- No fake 30-day prices; Yahoo only
- No live news / web search / news APIs
- No `Math.random` for prices, news, or scenario paths
- Tickmarks / LLM chart scrape remain on legacy **Agent** tab only

## UI

- Toggle: **Agent v2** in `DataModeToggle.tsx`
- Dashboard: `AgentV2DemoNewsPanel` + `AgentV2PredictionPanel` when `dataMode === 'agent-v2'`
