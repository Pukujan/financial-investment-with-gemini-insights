# Agent scrape mode

Third market data path alongside **Mock** and **Live (Tiingo)**. Uses OpenRouter LLM agents to extract structured quotes and news — no Tiingo API quota.

## Toggle

Header: **Mock | Live | Agent** (segmented control)

Or `.env`:

```bash
MARKET_DATA_MODE=agent
OPENROUTER_API_KEY=sk-or-v1-...
AGENT_SCRAPE_SYMBOL_LIMIT=20
AGENT_SCRAPE_BATCH_SIZE=5
AGENT_SCRAPE_CHART_BATCH_SIZE=1
AGENT_SCRAPE_BATCH_DELAY_MS=300
OPENROUTER_MODEL_PRIMARY=deepseek/deepseek-chat-v3-0324
OPENROUTER_MODEL_FALLBACK=qwen/qwen3.5-flash-02-23
# Optional eval overrides (defaults match above):
# AGENT_MODEL_STRONG=deepseek/deepseek-chat-v3-0324
# AGENT_MODEL_WEAK=qwen/qwen3.5-flash-02-23
```

## Token confirm UI

On the dashboard (same area as error banners):

1. Switch to **Agent** — shows token **estimate** before scraping.
2. **Confirm live scrape** — runs OpenRouter (`?forceLive=1`), shows actual tokens used.
3. **Use cache (0 tokens)** — when bulk/batches are cached.
4. **Refresh** in header (Agent mode) — re-opens estimate; confirm for live refresh.

`GET /api/agent-scrape/estimate` — preview cache hits and `~total` tokens without calling OpenRouter.

## Architecture

```
marketService (mode=agent)
  → agentScrapeService.fetchAgentQuotes / fetchAgentMarketNews
    → quoteScrapeAgent / newsScrapeAgent (OpenRouter)
```

Charts are **synthetic series** derived from agent quotes (no extra API calls per click).

## Golden eval

Golden cases live in `apps/backend/src/modules/agent-scrape/golden/*.json`.

Each case is run twice:

| Tier | Default model | Role |
|------|---------------|------|
| **strong** | `AGENT_MODEL_STRONG` (Llama 3.3 70B free) | Higher quality extraction |
| **weak** | `AGENT_MODEL_WEAK` (Qwen3 8B free) | Cheaper / weaker baseline |

### API

```bash
# List golden cases
curl http://localhost:3001/api/agent-scrape/golden

# Run full eval (slow — real OpenRouter calls)
curl -X POST http://localhost:3001/api/agent-scrape/eval

# Single case
curl -X POST "http://localhost:3001/api/agent-scrape/eval?caseId=quotes-core"

# Last report
curl http://localhost:3001/api/agent-scrape/eval/last
```

### CLI

```bash
npm run test:agent-eval   # RUN_AGENT_EVAL=1, needs OPENROUTER_API_KEY
```

## Scoring

- Quote cases: symbol presence, required fields, price within min/max bands
- News cases: article count, required fields, optional title keyword
- Pass threshold ~70% of weighted checks

## Disclaimer

Agent mode returns **LLM-estimated** prices and news, not exchange feeds. Use for demos and eval — not trading.
