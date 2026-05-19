import type { MarketDataMode, MarketDataSettings, NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import { mockNews, mockStocks } from '../../../data/mockData.js';
import { memoryCacheTtl } from '../../../config/cache.js';
import { env } from '../../../config/env.js';
import {
  getMarketDataMode,
  getQuoteDataMode,
  setMarketDataMode,
  updateMarketDataMode as applyMarketDataMode,
  setQuoteDataMode,
  type QuoteDataMode,
} from '../../../config/marketDataMode.js';
import { AppError } from '../../../middleware/errorHandler.js';
import {
  cacheKey,
  deleteMemoryCacheByPrefix,
  getMemoryCached,
  getMemoryCachedAt,
  getMemoryCachedStale,
  setMemoryCached,
} from '../../../utils/memoryCache.js';
import {
  isLiveMarketConfigured,
  liveMarketConfigError,
  liveMarketFetchError,
  resolveLiveProvider,
  type ResolvedLiveProvider,
} from './liveMarketProvider.js';
import {
  getAllMockQuotes,
  getMockQuote,
  getMockTimeSeries,
  MOCK_PROVIDER,
} from './mockQuoteProvider.js';
import {
  fetchTiingoBulk,
  fetchTiingoDailyBars,
  fetchTiingoMarketNews,
  fetchTiingoTimeSeries,
  isTiingoNewsForbidden,
  probeTiingoProvider,
  quoteFromTiingoBars,
  TIINGO_PROVIDER,
  timeSeriesFromTiingoBars,
} from './tiingoProvider.js';
import {
  fetchYahooBulk,
  fetchYahooChartQuotes,
  fetchYahooTimeSeries,
  probeYahooProvider,
  quoteFromYahooQuotes,
  seedYahooChartCache,
  YAHOO_PROVIDER,
  timeSeriesFromYahooQuotes,
  type YahooChartQuote,
} from './yahooProvider.js';
import { bulkCacheKey as agentBulkCacheKey } from '../../agent-scrape/services/agentScrapeCache.js';
import {
  AGENT_PROVIDER,
  agentScrapeConfigError,
  fetchAgentMarketNews,
  getAgentBulkCached,
  getAgentSymbols,
  getLastAgentBatchError,
  invalidateAgentScrapeCache,
  isAgentScrapeConfigured,
  type AgentBulkCache,
} from '../../agent-scrape/services/agentScrapeService.js';
import { readAgentBulkFromFirestore } from '../../agent-scrape/services/agentFirestoreCache.js';
import { effectiveMarketCacheMode } from './marketCacheMode.js';
import {
  logMarketStocks,
  logYahooChart,
  marketStocksCacheNote,
  type MarketStocksCacheSource,
} from './marketCacheLog.js';
import { normalizeSeriesBySymbol } from './marketSeriesUtils.js';
import type {
  BulkStocksCache,
  MarketFetchMeta,
  MarketNewsMeta,
  NewsCacheBundle,
} from './marketCacheTypes.js';
import {
  deleteAllMarketFirestoreCaches,
  readBulkStocksFromFirestore,
  readBulkStocksStaleFromFirestore,
  readNewsFromFirestore,
  readNewsStaleFromFirestore,
  writeBulkStocksToFirestore,
  writeNewsToFirestore,
} from './marketFirestoreCache.js';

export type { MarketFetchMeta, MarketNewsMeta } from './marketCacheTypes.js';

const ALL_SYMBOLS = mockStocks.map(s => s.symbol);
const STOCK_SYMBOLS =
  env.stockFetchLimit > 0 ? ALL_SYMBOLS.slice(0, env.stockFetchLimit) : ALL_SYMBOLS;
const STALE_BULK_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const NEWS_CACHE_KEY = 'feed';

const BULK_STOCKS_KEY = 'bulk';

const chartMetaBySymbol = new Map<
  string,
  { chartSource?: string; syntheticChart?: boolean; chartNote?: string }
>();

/** Catalog metadata only in mock mode — live quotes stay pure Tiingo. */
function enrichQuote(quote: StockQuote): StockQuote {
  if (getMarketDataMode() === 'live') {
    return quote;
  }
  const catalog = mockStocks.find(s => s.symbol === quote.symbol);
  if (!catalog) return quote;
  return {
    ...quote,
    name: catalog.name,
    sector: catalog.sector,
    pe: catalog.pe,
    marketCap: catalog.marketCap,
    volume: quote.volume === '—' ? catalog.volume : quote.volume,
  };
}

function cacheKeyForMode(baseKey: string): string {
  return `${baseKey}:${effectiveMarketCacheMode(getMarketDataMode(), getQuoteDataMode())}`;
}

function bulkStocksCacheKey(): string {
  return cacheKeyForMode(cacheKey('market', 'stocks', BULK_STOCKS_KEY));
}

function newsCacheKey(): string {
  return cacheKeyForMode(cacheKey('market', 'news', NEWS_CACHE_KEY));
}

function quotesCachedAtIso(): string | undefined {
  const ts = getMemoryCachedAt(bulkStocksCacheKey(), memoryCacheTtl.marketQuoteMs);
  return ts ? new Date(ts).toISOString() : undefined;
}

function newsCachedAtIso(): string | undefined {
  const ts = getMemoryCachedAt(newsCacheKey(), memoryCacheTtl.marketNewsMs);
  return ts ? new Date(ts).toISOString() : undefined;
}

/** Clears server RAM only — keeps Firestore bulk for other devices / restarts. */
export function invalidateMarketMemoryCache(): void {
  logMarketStocks('invalidate-memory', {
    firestoreConfigured: env.isFirebaseConfigured(),
    instanceId: env.firebaseAppInstanceId,
  });
  deleteMemoryCacheByPrefix('market:');
  invalidateAgentScrapeCache();
}

/** Full wipe including Firestore (use sparingly — breaks cross-device shared cache). */
export function invalidateMarketCache(): void {
  logMarketStocks('invalidate-all', {
    source: 'cache-invalidated',
    firestoreConfigured: env.isFirebaseConfigured(),
    instanceId: env.firebaseAppInstanceId,
  });
  invalidateMarketMemoryCache();
  void deleteAllMarketFirestoreCaches();
}

export interface AgentChartCacheLoadResult {
  loaded: boolean;
  chartSymbols: number;
  cachedAt?: string;
}

/** Hydrate agent LLM chart series from memory/Firestore into per-symbol timeseries keys. */
export async function loadAgentChartCacheIntoMarket(): Promise<AgentChartCacheLoadResult> {
  let agent = readAgentMemoryBulk();
  if (!agent?.seriesBySymbol || Object.keys(agent.seriesBySymbol).length === 0) {
    const fsBulk = await readAgentBulkFromFirestore();
    if (fsBulk?.seriesBySymbol && Object.keys(fsBulk.seriesBySymbol).length > 0) {
      agent = {
        quotes: fsBulk.quotes,
        seriesBySymbol: normalizeSeriesBySymbol(fsBulk.seriesBySymbol),
      };
      setMemoryCached(agentBulkCacheKey(), agent);
    }
  }

  if (!agent?.seriesBySymbol) {
    return { loaded: false, chartSymbols: 0 };
  }

  const chartSymbols = Object.values(agent.seriesBySymbol).filter(s => s?.length).length;
  if (chartSymbols === 0) {
    return { loaded: false, chartSymbols: 0 };
  }

  const bundle = agentBulkToMarketBulk(agent, {
    dataMode: 'agent',
    provider: AGENT_PROVIDER,
    fetched: agent.quotes.length,
    failed: 0,
  });
  hydrateChartSeriesFromBulk(bundle);

  const cachedAtMs = getMemoryCachedAt(agentBulkCacheKey(), memoryCacheTtl.marketQuoteMs);
  return {
    loaded: true,
    chartSymbols,
    cachedAt: cachedAtMs ? new Date(cachedAtMs).toISOString() : undefined,
  };
}

function hydrateChartSeriesFromBulk(bundle: BulkStocksCache): void {
  const seriesBySymbol = normalizeSeriesBySymbol(bundle.seriesBySymbol);
  const isAgent =
    bundle.meta.dataMode === 'agent' ||
    bundle.meta.provider === 'agent' ||
    bundle.meta.provider === AGENT_PROVIDER;
  for (const [symbol, series] of Object.entries(seriesBySymbol)) {
    if (!series.length) continue;
    const tsKey = cacheKeyForMode(cacheKey('market', 'timeseries', symbol));
    setMemoryCached(tsKey, series);
    chartMetaBySymbol.set(symbol, {
      chartSource: bundle.meta.provider,
      chartNote: isAgent
        ? '30-day chart from agent scrape cache.'
        : CHART_PRELOAD_NOTE,
    });
  }
}

function hydrateBulkCache(bundle: BulkStocksCache): void {
  const normalized: BulkStocksCache = {
    ...bundle,
    seriesBySymbol: normalizeSeriesBySymbol(bundle.seriesBySymbol),
  };
  setMemoryCached(bulkStocksCacheKey(), normalized);
  hydrateChartSeriesFromBulk(normalized);
  for (const stock of normalized.stocks) {
    setMemoryCached(
      cacheKeyForMode(cacheKey('market', 'quote', stock.symbol.toUpperCase())),
      stock
    );
  }
}

function agentBulkToMarketBulk(
  agent: AgentBulkCache,
  meta: MarketFetchMeta
): BulkStocksCache {
  return {
    stocks: agent.quotes,
    seriesBySymbol: normalizeSeriesBySymbol(agent.seriesBySymbol),
    meta,
  };
}

function bulkCacheHit(
  bundle: BulkStocksCache,
  cachedAt: string,
  cacheMeta: { cacheTtlHours: number },
  cacheSource: MarketStocksCacheSource,
  logDetail?: Record<string, unknown>
): {
  stocks: StockQuote[];
  meta: MarketFetchMeta;
} {
  hydrateBulkCache(bundle);
  logMarketStocks('hit', {
    source: cacheSource,
    count: bundle.stocks.length,
    cachedAt,
    bulkKey: bulkStocksCacheKey(),
    firestoreConfigured: env.isFirebaseConfigured(),
    ...logDetail,
  });
  return {
    stocks: bundle.stocks,
    meta: {
      ...bundle.meta,
      fromCache: true,
      cachedAt,
      cacheSource,
      cacheNote: marketStocksCacheNote(cacheSource),
      seriesBySymbol: bundle.seriesBySymbol,
      ...cacheMeta,
    },
  };
}

function assertLiveMarketConfigured(): void {
  if (!isLiveMarketConfigured()) {
    throw new AppError(liveMarketConfigError(), 503, 'MARKET_LIVE_UNAVAILABLE');
  }
}

function assertAgentScrapeConfigured(): void {
  if (!isAgentScrapeConfigured()) {
    throw new AppError(agentScrapeConfigError(), 503, 'AGENT_NOT_CONFIGURED');
  }
}

async function tryStaleBulkCache(warning: string): Promise<{
  stocks: StockQuote[];
  meta: MarketFetchMeta;
} | null> {
  const cacheMeta = { cacheTtlHours: env.marketCacheTtlHours };
  const stale = getMemoryCachedStale<BulkStocksCache>(
    bulkStocksCacheKey(),
    STALE_BULK_MAX_MS
  );
  if (stale) {
    const hit = bulkCacheHit(
      stale.data,
      new Date(stale.timestamp).toISOString(),
      cacheMeta,
      'memory-stale',
      { ageMs: Date.now() - stale.timestamp }
    );
    return {
      ...hit,
      meta: { ...hit.meta, warnings: [warning, ...(hit.meta.warnings ?? [])] },
    };
  }

  const fsStale = await readBulkStocksStaleFromFirestore(
    effectiveMarketCacheMode(getMarketDataMode(), getQuoteDataMode()),
    STALE_BULK_MAX_MS
  );
  if (!fsStale) return null;

  const hit = bulkCacheHit(
    fsStale.bundle,
    new Date(fsStale.timestamp).toISOString(),
    cacheMeta,
    'firestore-stale',
    { ageMs: Date.now() - fsStale.timestamp }
  );
  return {
    ...hit,
    meta: { ...hit.meta, warnings: [warning, ...(hit.meta.warnings ?? [])] },
  };
}

async function tryStaleNewsCache(warning: string): Promise<NewsCacheBundle | null> {
  const stale = getMemoryCachedStale<NewsCacheBundle>(newsCacheKey(), STALE_BULK_MAX_MS);
  if (stale) {
    return {
      articles: stale.data.articles,
      meta: {
        ...stale.data.meta,
        fromCache: true,
        cachedAt: new Date(stale.timestamp).toISOString(),
        cacheTtlHours: env.marketCacheTtlHours,
        warnings: [warning],
      },
    };
  }

  const fsStale = await readNewsStaleFromFirestore('live', STALE_BULK_MAX_MS);
  if (!fsStale) return null;

  setMemoryCached(newsCacheKey(), fsStale);
  return {
    articles: fsStale.articles,
    meta: {
      ...fsStale.meta,
      fromCache: true,
      cachedAt: fsStale.meta.cachedAt,
      cacheTtlHours: env.marketCacheTtlHours,
      warnings: [warning, ...(fsStale.meta.warnings ?? [])],
    },
  };
}

const CHART_PRELOAD_NOTE =
  '30-day chart preloaded with daily stock refresh (no extra Tiingo call).';

async function withTemporaryQuoteMode<T>(fn: () => Promise<T>): Promise<T> {
  const quoteMode = getQuoteDataMode();
  const prev = getMarketDataMode();
  if (prev !== quoteMode) setMarketDataMode(quoteMode, { preserveCache: true });
  try {
    return await fn();
  } finally {
    if (prev !== quoteMode) setMarketDataMode(prev, { preserveCache: true });
  }
}

function seriesMapToRecord(
  seriesBySymbol: Map<string, TimeSeriesData[]>
): Record<string, TimeSeriesData[]> {
  return Object.fromEntries(seriesBySymbol);
}

function readAgentMemoryBulk(): AgentBulkCache | null {
  return getMemoryCached<AgentBulkCache>(agentBulkCacheKey(), memoryCacheTtl.marketQuoteMs);
}

function getFreshBulkCache(): BulkStocksCache | null {
  const market = getMemoryCached<BulkStocksCache>(
    bulkStocksCacheKey(),
    memoryCacheTtl.marketQuoteMs
  );
  if (market?.stocks.length) return market;

  if (getMarketDataMode() === 'agent') {
    const agent = readAgentMemoryBulk();
    if (agent?.quotes.length) {
      return agentBulkToMarketBulk(agent, {
        dataMode: 'agent',
        provider: AGENT_PROVIDER,
        fetched: agent.quotes.length,
        failed: 0,
      });
    }
  }

  return null;
}

async function resolveBulkCacheForCharts(): Promise<BulkStocksCache | null> {
  const mem = getFreshBulkCache();
  if (mem) return mem;

  const mode = getMarketDataMode();
  const quoteCacheMode = effectiveMarketCacheMode(mode, getQuoteDataMode());
  if (quoteCacheMode === 'live' || quoteCacheMode === 'mock') {
    const fsDoc = await readBulkStocksFromFirestore(quoteCacheMode);
    if (fsDoc) {
      const { lastUpdated, createdAt: _c, ...bundle } = fsDoc as BulkStocksCache & {
        lastUpdated?: number;
        createdAt?: number;
      };
      if (bundle.stocks.length) {
        hydrateBulkCache(bundle);
        return getFreshBulkCache();
      }
    }

    const fsStale = await readBulkStocksStaleFromFirestore(quoteCacheMode, STALE_BULK_MAX_MS);
    if (fsStale?.bundle.stocks.length) {
      hydrateBulkCache(fsStale.bundle);
      return getFreshBulkCache();
    }
  }

  if (mode === 'agent') {
    const agentFs = await readAgentBulkFromFirestore();
    if (agentFs?.quotes.length) {
      const bundle = agentBulkToMarketBulk(
        {
          quotes: agentFs.quotes,
          seriesBySymbol: agentFs.seriesBySymbol,
        },
        {
          dataMode: 'agent',
          provider: AGENT_PROVIDER,
          fetched: agentFs.quotes.length,
          failed: 0,
        }
      );
      hydrateBulkCache(bundle);
      return bundle;
    }
  }

  const stale = getMemoryCachedStale<BulkStocksCache>(
    bulkStocksCacheKey(),
    STALE_BULK_MAX_MS
  );
  if (stale?.data.stocks.length) {
    return stale.data;
  }

  return null;
}

function chartQuotesFromTimeSeries(series: TimeSeriesData[]): YahooChartQuote[] {
  return series.map(bar => ({
    date: new Date(`${bar.timestamp}T00:00:00.000Z`),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
}

/**
 * Yahoo golden for evals: per-symbol TTL cache → market bulk preload → API.
 */
export async function resolveYahooChartQuotes(symbol: string): Promise<YahooChartQuote[]> {
  const sym = symbol.trim().toUpperCase();
  const bulk = await resolveBulkCacheForCharts();
  const series = getPreloadedTimeSeries(sym, bulk);
  if (series?.length) {
    const quotes = chartQuotesFromTimeSeries(series);
    seedYahooChartCache(sym, quotes);
    logYahooChart('hit', { symbol: sym, source: 'bulk-preload', bars: quotes.length });
    return quotes;
  }
  logYahooChart('miss-bulk', {
    symbol: sym,
    source: 'miss',
    firestoreConfigured: env.isFirebaseConfigured(),
  });
  return fetchYahooChartQuotes(symbol);
}

function getPreloadedTimeSeries(symbol: string, bulk?: BulkStocksCache | null): TimeSeriesData[] | null {
  const sym = symbol.toUpperCase();
  const cache = bulk ?? getFreshBulkCache();
  const fresh = cache?.seriesBySymbol[sym];
  if (fresh?.length) return fresh;

  const stale = getMemoryCachedStale<BulkStocksCache>(
    bulkStocksCacheKey(),
    STALE_BULK_MAX_MS
  );
  const fromStale = stale?.data.seriesBySymbol[sym];
  return fromStale?.length ? fromStale : null;
}

function findQuoteInBulkCache(symbol: string): StockQuote | null {
  const sym = symbol.toUpperCase();
  const fresh = getFreshBulkCache()?.stocks.find(
    s => s.symbol.toUpperCase() === sym
  );
  if (fresh) return fresh;

  const stale = getMemoryCachedStale<BulkStocksCache>(
    bulkStocksCacheKey(),
    STALE_BULK_MAX_MS
  );
  return stale?.data.stocks.find(s => s.symbol.toUpperCase() === sym) ?? null;
}

function mockNewsArticles(): NewsArticle[] {
  return mockNews.map(n => ({
    title: n.title,
    url: '#',
    summary: n.summary,
    source: n.author || 'Financial Times',
    category: n.category,
    sentiment: n.sentiment,
    time_published: new Date(
      Date.now() - Math.random() * 24 * 60 * 60 * 1000
    ).toISOString(),
    ticker_sentiment: n.relatedStocks.map(ticker => ({
      ticker,
      relevance_score: '0.8',
      ticker_sentiment_score:
        n.sentiment === 'positive' ? '0.5' : n.sentiment === 'negative' ? '-0.5' : '0',
    })),
    imageUrl: n.imageUrl,
    author: n.author,
    content: n.content,
  }));
}

export async function getMarketSettings(probe = false): Promise<MarketDataSettings> {
  const dataMode = getMarketDataMode();
  const quotesCachedAt = dataMode !== 'mock' ? quotesCachedAtIso() : undefined;
  const newsCachedAt = dataMode !== 'mock' ? newsCachedAtIso() : undefined;
  let liveReachable: boolean | null = null;
  let liveProbeError: string | undefined;

  if (dataMode === 'live' && !isLiveMarketConfigured()) {
    liveReachable = false;
    liveProbeError = liveMarketConfigError();
  } else if (dataMode === 'live' && quotesCachedAt && !probe) {
    liveReachable = true;
  } else if (probe && dataMode === 'live') {
    const probeResult = await probeLiveProvider();
    liveReachable = probeResult.reachable;
    liveProbeError = probeResult.error;
  } else if (dataMode === 'agent') {
    const quoteMode = getQuoteDataMode();
    if (quoteMode === 'mock') {
      liveReachable = true;
    } else if (!isLiveMarketConfigured()) {
      liveReachable = false;
      liveProbeError = liveMarketConfigError();
    } else if (quotesCachedAt && !probe) {
      liveReachable = true;
    } else if (probe) {
      const probeResult = await probeLiveProvider();
      liveReachable = probeResult.reachable;
      liveProbeError = probeResult.error;
    } else {
      liveReachable = true;
    }
  }

  const quoteMode = getQuoteDataMode();
  const provider =
    dataMode === 'live'
      ? resolveLiveProvider()
      : dataMode === 'agent'
        ? quoteMode === 'live'
          ? resolveLiveProvider()
          : MOCK_PROVIDER
        : MOCK_PROVIDER;

  return {
    dataMode,
    quoteDataMode: quoteMode,
    provider,
    liveReachable,
    liveProbeError,
    stockFetchLimit: env.stockFetchLimit,
    cacheTtlHours: env.marketCacheTtlHours,
    quotesCachedAt,
    newsCachedAt,
  };
}

export function updateMarketDataMode(
  mode: MarketDataMode,
  quoteDataMode?: QuoteDataMode
): MarketDataSettings {
  if (mode !== 'live' && mode !== 'mock' && mode !== 'agent') {
    throw new AppError('dataMode must be "live", "mock", or "agent"', 400, 'INVALID_MARKET_MODE');
  }
  if (quoteDataMode && quoteDataMode !== 'live' && quoteDataMode !== 'mock') {
    throw new AppError('quoteDataMode must be "live" or "mock"', 400, 'INVALID_QUOTE_MODE');
  }
  applyMarketDataMode(mode);
  if (quoteDataMode) setQuoteDataMode(quoteDataMode);
  const provider =
    mode === 'live'
      ? resolveLiveProvider()
      : mode === 'agent'
        ? getQuoteDataMode() === 'live'
          ? resolveLiveProvider()
          : MOCK_PROVIDER
        : MOCK_PROVIDER;
  return {
    dataMode: mode,
    quoteDataMode: getQuoteDataMode(),
    provider,
    liveReachable: null,
    stockFetchLimit: env.stockFetchLimit,
    cacheTtlHours: env.marketCacheTtlHours,
    quotesCachedAt: mode !== 'mock' ? quotesCachedAtIso() : undefined,
    newsCachedAt: mode !== 'mock' ? newsCachedAtIso() : undefined,
  };
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const mode = getMarketDataMode();
  const key = cacheKeyForMode(cacheKey('market', 'quote', symbol));
  const cached = getMemoryCached<StockQuote>(key, memoryCacheTtl.marketQuoteMs);
  if (cached) return enrichQuote(cached);

  if (mode === 'mock') {
    const quote = getMockQuote(symbol);
    setMemoryCached(key, quote);
    return quote;
  }

  if (mode === 'agent') {
    return withTemporaryQuoteMode(() => getStockQuote(symbol));
  }

  assertLiveMarketConfigured();

  const fromBulk = findQuoteInBulkCache(symbol);
  if (fromBulk) {
    const enriched = enrichQuote(fromBulk);
    setMemoryCached(key, enriched);
    return enriched;
  }

  if (!env.tiingoChartOnDemand) {
    throw new AppError(
      `No live quote for ${symbol} yet. Wait for the daily stock refresh to finish or click Refresh.`,
      503,
      'MARKET_LIVE_UNAVAILABLE'
    );
  }

  const liveProvider = resolveLiveProvider();
  if (liveProvider === YAHOO_PROVIDER) {
    const chartQuotes = await fetchYahooChartQuotes(symbol);
    const quote = enrichQuote(quoteFromYahooQuotes(symbol, chartQuotes));
    const tsKey = cacheKeyForMode(cacheKey('market', 'timeseries', symbol));
    setMemoryCached(tsKey, timeSeriesFromYahooQuotes(chartQuotes));
    chartMetaBySymbol.set(symbol, { chartSource: 'yahoo', chartNote: CHART_PRELOAD_NOTE });
    setMemoryCached(key, quote);
    return quote;
  }

  const bars = await fetchTiingoDailyBars(symbol);
  const quote = enrichQuote(quoteFromTiingoBars(symbol, bars));
  const tsKey = cacheKeyForMode(cacheKey('market', 'timeseries', symbol));
  setMemoryCached(tsKey, timeSeriesFromTiingoBars(bars));
  chartMetaBySymbol.set(symbol, {
    chartSource: 'tiingo',
    chartNote: CHART_PRELOAD_NOTE,
  });
  setMemoryCached(key, quote);
  return quote;
}

export async function getAllStocks(options?: {
  refresh?: boolean;
  forceLive?: boolean;
  agentTier?: import('@investai/shared').AiCostTier;
}): Promise<{
  stocks: StockQuote[];
  meta: MarketFetchMeta & { agentScrape?: import('@investai/shared').AgentScrapeUsage };
}> {
  const mode = getMarketDataMode();
  const cacheMeta = { cacheTtlHours: env.marketCacheTtlHours };

  if (options?.refresh && !options?.forceLive) {
    invalidateMarketMemoryCache();
  }

  if (options?.forceLive) {
    invalidateAgentScrapeCache();
  }

  logMarketStocks('request', {
    dataMode: mode,
    quoteDataMode: getQuoteDataMode(),
    refresh: Boolean(options?.refresh),
    forceLive: Boolean(options?.forceLive),
    bulkKey: bulkStocksCacheKey(),
    firestoreConfigured: env.isFirebaseConfigured(),
    instanceId: env.firebaseAppInstanceId,
  });

  if (mode === 'live' && !options?.refresh) {
    const bulkKey = bulkStocksCacheKey();
    const cached = getMemoryCached<BulkStocksCache>(bulkKey, memoryCacheTtl.marketQuoteMs);
    if (cached) {
      return bulkCacheHit(
        cached,
        quotesCachedAtIso() ?? new Date().toISOString(),
        cacheMeta,
        'memory'
      );
    }

    const fsDoc = await readBulkStocksFromFirestore('live');
    if (fsDoc) {
      const { lastUpdated, createdAt: _c, ...bundle } = fsDoc as BulkStocksCache & {
        lastUpdated?: number;
        createdAt?: number;
      };
      const cachedAt =
        typeof lastUpdated === 'number'
          ? new Date(lastUpdated).toISOString()
          : new Date().toISOString();
      return bulkCacheHit(bundle, cachedAt, cacheMeta, 'firestore-fresh', {
        docId: `${env.firebaseAppInstanceId}_live`,
      });
    }

    const fsStale = await readBulkStocksStaleFromFirestore('live', STALE_BULK_MAX_MS);
    if (fsStale?.bundle.stocks.length) {
      const hit = bulkCacheHit(
        fsStale.bundle,
        new Date(fsStale.timestamp).toISOString(),
        cacheMeta,
        'firestore-stale',
        { ageMs: Date.now() - fsStale.timestamp }
      );
      return {
        ...hit,
        meta: {
          ...hit.meta,
          warnings: [
            'Showing cached live prices from Firestore (past TTL, still within stale window).',
            ...(hit.meta.warnings ?? []),
          ],
        },
      };
    }

    logMarketStocks('miss-live', {
      source: 'miss',
      reason: 'no-memory-or-firestore-bulk',
      firestoreConfigured: env.isFirebaseConfigured(),
    });
  }

  if (mode === 'mock') {
    const stocks = getAllMockQuotes(STOCK_SYMBOLS);
    logMarketStocks('hit', { source: 'mock-catalog', count: stocks.length });
    return {
      stocks,
      meta: {
        dataMode: 'mock',
        provider: MOCK_PROVIDER,
        fetched: stocks.length,
        failed: 0,
        fromCache: true,
        cacheSource: 'mock-catalog',
        cacheNote: marketStocksCacheNote('mock-catalog'),
      },
    };
  }

  if (mode === 'agent') {
    const quoteMode = getQuoteDataMode();

    if (!options?.refresh && quoteMode === 'live') {
      const bulkKey = bulkStocksCacheKey();
      const memCached = getMemoryCached<BulkStocksCache>(bulkKey, memoryCacheTtl.marketQuoteMs);
      if (memCached?.stocks.length) {
        const hit = bulkCacheHit(
          memCached,
          quotesCachedAtIso() ?? new Date().toISOString(),
          cacheMeta,
          'memory'
        );
        return {
          stocks: hit.stocks,
          meta: {
            ...hit.meta,
            dataMode: 'agent',
            warnings: [
              ...(hit.meta.warnings ?? []),
              'Quotes from Live (memory). Use Agent panel for 30-day LLM chart jobs.',
            ],
          },
        };
      }

      const fsDoc = await readBulkStocksFromFirestore('live');
      if (fsDoc) {
        const { lastUpdated, createdAt: _c, ...bundle } = fsDoc as BulkStocksCache & {
          lastUpdated?: number;
          createdAt?: number;
        };
        const cachedAt =
          typeof lastUpdated === 'number'
            ? new Date(lastUpdated).toISOString()
            : new Date().toISOString();
        const hit = bulkCacheHit(bundle, cachedAt, cacheMeta, 'firestore-fresh', {
          docId: `${env.firebaseAppInstanceId}_live`,
        });
        return {
          stocks: hit.stocks,
          meta: {
            ...hit.meta,
            dataMode: 'agent',
            warnings: [
              ...(hit.meta.warnings ?? []),
              'Quotes from Live (Firestore). Use Agent panel for 30-day LLM chart jobs.',
            ],
          },
        };
      }

      const fsStale = await readBulkStocksStaleFromFirestore('live', STALE_BULK_MAX_MS);
      if (fsStale?.bundle.stocks.length) {
        const hit = bulkCacheHit(
          fsStale.bundle,
          new Date(fsStale.timestamp).toISOString(),
          cacheMeta,
          'firestore-stale',
          { ageMs: Date.now() - fsStale.timestamp }
        );
        return {
          stocks: hit.stocks,
          meta: {
            ...hit.meta,
            dataMode: 'agent',
            warnings: [
              'Showing cached live prices from Firestore (past TTL, still within stale window).',
              ...(hit.meta.warnings ?? []),
              'Quotes from Live. Use Agent panel for 30-day LLM chart jobs.',
            ],
          },
        };
      }

      logMarketStocks('miss-agent-live', {
        source: 'miss',
        reason: 'no-memory-or-firestore-bulk-before-quote-fetch',
        firestoreConfigured: env.isFirebaseConfigured(),
      });
    }

    const { stocks, meta } = await withTemporaryQuoteMode(() =>
      getAllStocks({ ...options, refresh: options?.refresh })
    );
    const quoteLabel = quoteMode === 'live' ? 'Live' : 'Mock';
    return {
      stocks,
      meta: {
        ...meta,
        dataMode: 'agent',
        warnings: [
          ...(meta.warnings ?? []),
          `Quotes from ${quoteLabel}. Use Agent panel for 30-day LLM chart jobs.`,
        ],
      },
    };
  }

  assertLiveMarketConfigured();

  const liveProvider = resolveLiveProvider();
  const providerSource: MarketStocksCacheSource =
    liveProvider === YAHOO_PROVIDER ? 'provider-yahoo' : 'provider-tiingo';
  logMarketStocks('provider-fetch-start', {
    source: providerSource,
    provider: liveProvider,
    symbolCount: STOCK_SYMBOLS.length,
  });
  const bulk =
    liveProvider === YAHOO_PROVIDER
      ? await fetchYahooBulk(STOCK_SYMBOLS)
      : await fetchTiingoBulk(STOCK_SYMBOLS);
  const stockResults = bulk.quotes.map(enrichQuote);
  const providerLabel = liveProvider === YAHOO_PROVIDER ? 'Yahoo' : 'Tiingo';

  for (const enriched of stockResults) {
    setMemoryCached(
      cacheKeyForMode(cacheKey('market', 'quote', enriched.symbol)),
      enriched
    );
  }

  const failedCount = bulk.failedSymbols.length;

  if (stockResults.length === 0) {
    const stale = await tryStaleBulkCache(
      `Could not reach ${providerLabel}. Showing last cached live prices if available.`
    );
    if (stale) return stale;

    throw new AppError(liveMarketFetchError(), 503, 'MARKET_LIVE_UNAVAILABLE');
  }

  const warnings =
    failedCount > 0
      ? [
          `${failedCount} symbols could not be loaded from ${providerLabel}`,
          ...(failedCount <= 10 ? [bulk.failedSymbols.join(', ')] : []),
        ]
      : undefined;

  const seriesBySymbol = normalizeSeriesBySymbol(seriesMapToRecord(bulk.seriesBySymbol));
  const meta: MarketFetchMeta = {
    dataMode: 'live',
    provider: liveProvider,
    fetched: stockResults.length,
    failed: failedCount,
    failedSymbols: failedCount > 0 ? bulk.failedSymbols : undefined,
    warnings,
    fromCache: false,
    cachedAt: new Date().toISOString(),
    cacheSource: providerSource,
    cacheNote: marketStocksCacheNote(providerSource),
    seriesBySymbol,
    ...cacheMeta,
  };

  const bulkBundle: BulkStocksCache = {
    stocks: stockResults,
    seriesBySymbol,
    meta,
  };
  hydrateBulkCache(bulkBundle);
  void writeBulkStocksToFirestore('live', bulkBundle);
  logMarketStocks('provider-fetch-done', {
    source: providerSource,
    count: stockResults.length,
    failed: failedCount,
    wroteFirestore: env.isFirebaseConfigured(),
    docId: `${env.firebaseAppInstanceId}_live`,
  });

  return { stocks: stockResults, meta };
}

export async function getMarketNews(): Promise<NewsArticle[]> {
  const { articles } = await getMarketNewsWithMeta();
  return articles;
}

export async function getMarketNewsWithMeta(options?: {
  agentTier?: import('@investai/shared').AiCostTier;
}): Promise<NewsCacheBundle> {
  const mode = getMarketDataMode();
  const cacheMeta = { cacheTtlHours: env.marketCacheTtlHours };

  if (mode === 'live') {
    const cached = getMemoryCached<NewsCacheBundle>(newsCacheKey(), memoryCacheTtl.marketNewsMs);
    if (cached) {
      return {
        articles: cached.articles,
        meta: {
          ...cached.meta,
          fromCache: true,
          cachedAt: newsCachedAtIso(),
          ...cacheMeta,
        },
      };
    }

    const fsDoc = await readNewsFromFirestore('live');
    if (fsDoc) {
      const { lastUpdated, createdAt: _c, ...bundle } = fsDoc as NewsCacheBundle & {
        lastUpdated?: number;
        createdAt?: number;
      };
      const cachedAt =
        typeof lastUpdated === 'number'
          ? new Date(lastUpdated).toISOString()
          : bundle.meta.cachedAt;
      setMemoryCached(newsCacheKey(), bundle);
      return {
        articles: bundle.articles,
        meta: {
          ...bundle.meta,
          fromCache: true,
          cachedAt,
          ...cacheMeta,
          warnings: bundle.meta.warnings,
        },
      };
    }
  }

  if (mode === 'mock') {
    const articles = mockNewsArticles();
    const meta: MarketNewsMeta = {
      dataMode: 'mock',
      provider: MOCK_PROVIDER,
      count: articles.length,
    };
    setMemoryCached(newsCacheKey(), { articles, meta });
    return { articles, meta };
  }

  if (mode === 'agent') {
    const bundle = await withTemporaryQuoteMode(() => getMarketNewsWithMeta(options));
    return {
      articles: bundle.articles,
      meta: {
        ...bundle.meta,
        dataMode: 'agent',
        warnings: [
          ...(bundle.meta.warnings ?? []),
          `News from ${getQuoteDataMode() === 'live' ? 'Live' : 'Mock'} quote source.`,
        ],
      },
    };
  }

  assertLiveMarketConfigured();

  const liveProvider = resolveLiveProvider();
  if (liveProvider === YAHOO_PROVIDER) {
    const articles = mockNewsArticles();
    const meta: MarketNewsMeta = {
      dataMode: 'live',
      provider: YAHOO_PROVIDER,
      count: articles.length,
      fromCache: false,
      cachedAt: new Date().toISOString(),
      warnings: [
        'News from demo catalog — Yahoo chart API has no news feed. Use Tiingo or Agent mode for live news.',
      ],
      ...cacheMeta,
    };
    const bundle = { articles, meta };
    setMemoryCached(newsCacheKey(), bundle);
    void writeNewsToFirestore('live', bundle);
    return bundle;
  }

  try {
    const articles = await fetchTiingoMarketNews();
    const meta: MarketNewsMeta = {
      dataMode: 'live',
      provider: TIINGO_PROVIDER,
      count: articles.length,
      fromCache: false,
      cachedAt: new Date().toISOString(),
      ...cacheMeta,
    };
    const bundle = { articles, meta };
    setMemoryCached(newsCacheKey(), bundle);
    void writeNewsToFirestore('live', bundle);
    return bundle;
  } catch (error) {
    console.warn('Tiingo news failed:', error);
    const stale = await tryStaleNewsCache(
      'Could not reach Tiingo news. Showing last cached articles if available.'
    );
    if (stale) return stale;

    const newsForbidden = isTiingoNewsForbidden(error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    throw new AppError(
      newsForbidden
        ? 'Live news requires Tiingo News API (not included on free EOD plan). Switch to Mock mode or upgrade at tiingo.com/products/news-feed-api.'
        : `Live news unavailable (Tiingo): ${detail}`,
      503,
      newsForbidden ? 'MARKET_NEWS_FORBIDDEN' : 'MARKET_NEWS_UNAVAILABLE'
    );
  }
}

export function getTimeSeriesMeta(symbol: string): Record<string, unknown> | undefined {
  return chartMetaBySymbol.get(symbol);
}

export async function getTimeSeriesDaily(symbol: string): Promise<TimeSeriesData[]> {
  const mode = getMarketDataMode();
  const key = cacheKeyForMode(cacheKey('market', 'timeseries', symbol));
  const cached = getMemoryCached<TimeSeriesData[]>(key, memoryCacheTtl.marketTimeSeriesMs);
  if (cached) return cached;

  if (mode === 'mock') {
    const series = getMockTimeSeries(symbol);
    setMemoryCached(key, series);
    chartMetaBySymbol.delete(symbol);
    return series;
  }

  if (mode === 'agent') {
    const bulk = await resolveBulkCacheForCharts();
    const preloaded = getPreloadedTimeSeries(symbol, bulk);
    if (preloaded) {
      setMemoryCached(key, preloaded);
      chartMetaBySymbol.set(symbol.toUpperCase(), {
        chartSource: AGENT_PROVIDER,
        chartNote: '30-day chart from agent job cache.',
      });
      return preloaded;
    }
    return withTemporaryQuoteMode(() => getTimeSeriesDaily(symbol));
  }

  assertLiveMarketConfigured();

  const liveProvider = resolveLiveProvider();
  const bulk = await resolveBulkCacheForCharts();
  const preloaded = getPreloadedTimeSeries(symbol, bulk);
  if (preloaded) {
    setMemoryCached(key, preloaded);
    chartMetaBySymbol.set(symbol.toUpperCase(), {
      chartSource: liveProvider,
      chartNote: CHART_PRELOAD_NOTE,
    });
    return preloaded;
  }

  if (env.tiingoChartOnDemand) {
    try {
      const data =
        liveProvider === YAHOO_PROVIDER
          ? await fetchYahooTimeSeries(symbol)
          : await fetchTiingoTimeSeries(symbol);
      setMemoryCached(key, data);
      chartMetaBySymbol.set(symbol, {
        chartSource: liveProvider,
        chartNote: `Chart fetched on demand from ${liveProvider === YAHOO_PROVIDER ? 'Yahoo' : 'Tiingo'}.`,
      });
      return data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch live chart data';
      throw new AppError(
        `Live chart data unavailable for ${symbol}: ${message}`,
        503,
        'MARKET_LIVE_UNAVAILABLE'
      );
    }
  }

  throw new AppError(
    `Chart for ${symbol} is not loaded yet. Wait for the daily stock refresh to finish (dashboard stocks list), then open the chart again.`,
    503,
    'MARKET_CHART_NOT_PRELOADED'
  );
}

export function getEnrichedStockInputs(stocks: StockQuote[]) {
  const mode = getMarketDataMode();
  return stocks.slice(0, 8).map(stock => {
    if (mode === 'live') {
      return {
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        price: stock.price,
        change: stock.change,
        pe: stock.pe ?? 0,
        marketCap: stock.marketCap ?? 'N/A',
      };
    }
    const catalog = mockStocks.find(s => s.symbol === stock.symbol);
    return {
      symbol: stock.symbol,
      name: catalog?.name || stock.name || stock.symbol,
      price: stock.price,
      change: stock.change,
      pe: catalog?.pe || stock.pe || 0,
      marketCap: catalog?.marketCap || stock.marketCap || 'N/A',
    };
  });
}

export async function probeLiveProvider(): Promise<{
  reachable: boolean;
  error?: string;
}> {
  return resolveLiveProvider() === YAHOO_PROVIDER
    ? probeYahooProvider()
    : probeTiingoProvider();
}
