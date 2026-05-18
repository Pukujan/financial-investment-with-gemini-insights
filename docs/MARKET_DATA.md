# Market data: live vs mock

## Quick answer: do you need a Yahoo API key?

**No.** Yahoo does not offer a public retail API key for this use case. This app uses the same **unofficial** chart endpoints many open-source tools use:

- `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}`

The backend fetches them directly (with a `User-Agent` header). No signup, no key, no billing — but also **no SLA**: Yahoo can rate-limit or block requests.

For production or compliance-sensitive apps, use a **licensed** provider instead (see below).

## Modes in this app

| Mode | Source | API key | Behavior |
|------|--------|---------|----------|
| **Live** | Yahoo Finance (server-side) | None | Real prices; **503** if Yahoo is unreachable (no silent mock fallback) |
| **Mock** | `apps/backend/src/data/mockData.ts` | None | Static catalog; works offline |

Toggle in the app header (**Mock ↔ Live**), or set default in `.env`:

```bash
MARKET_DATA_MODE=live   # or mock
```

Runtime mode is stored in server memory (resets on restart to `MARKET_DATA_MODE`).

### Once-per-day usage (recommended with Yahoo)

Live quotes are cached **24 hours** by default so Yahoo is only hit once per day:

```bash
MARKET_CACHE_TTL_HOURS=24
```

- Page loads and navigation reuse cached prices (fast, no Yahoo spam).
- **Refresh** in the header forces a new Yahoo fetch (`?refresh=1`).
- Cache clears on server restart or when switching Mock ↔ Live.

### API

- `GET /api/market/settings?probe=1` — current mode + optional Yahoo connectivity probe
- `PUT /api/market/settings` — body: `{ "dataMode": "live" | "mock" }`
- `GET /api/market/stocks` — returns `meta.dataMode`, `meta.provider`, `meta.warnings` on partial live failures

Errors when live is down:

```json
{
  "success": false,
  "error": "Live market data unavailable (Yahoo Finance). ...",
  "code": "MARKET_LIVE_UNAVAILABLE"
}
```

## Free alternatives (with API keys)

If you need terms of service, support, or news:

| Provider | Free tier | Sign up | Notes |
|----------|-----------|---------|-------|
| [Alpha Vantage](https://www.alphavantage.co/support/#api-key) | ~25 req/day | Email → instant key | Good for demos; strict limits |
| [Finnhub](https://finnhub.io/register) | 60 calls/min | Free account | Quotes, news on paid tiers |
| [Polygon.io](https://polygon.io/) | Limited free | Account required | US markets focus |
| [Twelve Data](https://twelvedata.com/) | 800 credits/day | API key | Broad symbols |

News in this app is still **mock-only** (`mockData.ts`). Wiring Finnhub or Alpha Vantage news would need a new env key and service module.

## News

Market news is not live yet. Use mock mode or extend `marketService.getMarketNews()` with a provider that offers a news API.

## Test if Yahoo is working

Unit tests (mocked, no network):

```bash
npm test
```

Live Yahoo check (one real request — wait if dev server just fetched stocks):

```bash
npm run test:yahoo
```

Skip live tests in CI: `SKIP_YAHOO_INTEGRATION=1` (default for `npm test`).

## Troubleshooting live mode

1. Confirm backend can reach Yahoo: `curl -H "User-Agent: InvestAI" "https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=1d"`
2. Check `GET /api/health` → `checks.marketLiveReachable`
3. If blocked on a network/VPN, switch to **Mock** in the UI
4. Reduce load: `STOCK_FETCH_LIMIT=20` in `.env`
