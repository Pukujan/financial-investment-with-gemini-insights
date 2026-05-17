# Cache architecture

All caching is **server-side**. The frontend has no HTTP response cache (only React state in providers).

## Layers overview

| Layer | Where | TTL | Scope | Used for |
|-------|--------|-----|--------|----------|
| **Memory** | `utils/memoryCache.ts` | 60s (config) | Single Node process | Yahoo quotes, news, charts |
| **Firestore** | `utils/firestoreCache.ts` | 15m / 24h | Shared across restarts | AI insights, predictions |
| **Portfolio** | Firestore direct | — | Persistent | User holdings (not a cache) |
| **React state** | FE providers | Until refresh | Browser tab | UI display |

Config: [`apps/backend/src/config/cache.ts`](../apps/backend/src/config/cache.ts)

---

## Memory cache (market module)

- **Keys:** `market:quote:{symbol}`, `market:news:default`, `market:timeseries:{symbol}`
- **Helper:** `cacheKey(module, resource, id)` in `memoryCache.ts`
- **Lost on:** server restart
- **Used by:** `marketService.ts` only

```ts
const key = cacheKey('market', 'quote', symbol);
const hit = getMemoryCached<StockQuote>(key, memoryCacheTtl.marketQuoteMs);
```

---

## Firestore cache (AI module)

Shared read/write helpers — do not duplicate `getDoc`/`setDoc` in services.

| Collection | Doc ID | TTL | Service |
|------------|--------|-----|---------|
| `aiInsights` | `{FIREBASE_APP_INSTANCE_ID}` | 15 min | `insightsCacheService` |
| `stockPredictions` | `{instanceId}_{symbol}` | 24 h | `predictionCacheService` |

```ts
await readFirestoreCache(collection, docId, ttlMs, 'lastUpdated' | 'createdAt');
await writeFirestoreCache(collection, docId, payload);
```

If Firebase is not configured, reads return `null` and writes are skipped — AI still runs, uncached.

---

## AI insights flow (cache-first)

`getAIInsights()` in `insightsCacheService.ts`:

1. Check Firestore → return if fresh (**skips Yahoo + OpenRouter**)
2. Else fetch stocks + news → generate AI → write Firestore

Controller only calls `getAIInsights()` — no duplicate market fetches on cache hit.

---

## Frontend “cache”

| Provider | What it holds | Refresh |
|----------|---------------|---------|
| `MarketDataProvider` | stocks, news | `refreshMarketData()` |
| `AIInsightsProvider` | aiInsights | `refreshInsights()` |
| `PortfolioProvider` | holdings | save on CRUD |

No TanStack Query / SWR yet — add later if you need stale-while-revalidate.

---

## Modularization rules

1. **TTLs** live in `config/cache.ts` — not magic numbers in services.
2. **Memory cache** only in market (Yahoo) via `memoryCache.ts`.
3. **Firestore cache** only via `firestoreCache.ts` — AI services must not call Firestore directly.
4. **Portfolio** is persistence, not TTL cache — uses `portfolioService` + dedicated collection.
5. **Do not cache** in controllers or views.

---

## Changing TTLs

Edit `apps/backend/src/config/cache.ts`:

```ts
export const memoryCacheTtl = { marketQuoteMs: 60_000, ... };
export const firestoreCacheTtl = { aiInsightsMs: 15 * 60 * 1000, ... };
```

Future: optional env overrides (e.g. `AI_INSIGHTS_CACHE_MS`).

---

## Known limitations

- **Prediction cache** is per symbol, not per chart payload — changing dates within 24h may return stale prediction.
- **Memory cache** is not shared across multiple server instances (use Redis if you scale horizontally).
- **Refresh button** on frontend re-fetches everything; no cache-bust query param yet.
