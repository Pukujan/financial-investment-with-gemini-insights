import type { MarketDataMode, MarketDataSettings, NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import { marketModeUsesYahooLive } from '@investai/shared';
import { findCatalogMetadata, getTrackedSymbols } from '../../../data/symbolCatalog.js';
import { getDemoNewsArticles } from '../../../data/demoNewsCatalog.js';
import { assertLiveQuoteProvider } from '../../../contracts/marketPath.js';
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
  deleteMemoryCache,
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
import {
  readAgentBulkFromFirestore,
  readAgentBulkStaleFromFirestore,
} from '../../agent-scrape/services/agentFirestoreCache.js';
import { bulkFirestoreSlot, effectiveMarketCacheMode } from './marketCacheMode.js';
import type { MarketBulkFirestoreSlot } from './marketCacheMode.js';
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

const STOCK_SYMBOLS =
  env.stockFetchLimit > 0
    ? getTrackedSymbols(env.stockFetchLimit)
    : getTrackedSymbols();
const STALE_BULK_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const NEWS_CACHE_KEY = 'feed';

const BULK_STOCKS_KEY = 'bulk';

const chartMetaBySymbol = new Map<
  string,
  {
    chartSource?: string;
    syntheticChart?: boolean;
    chartNote?: string;
    chartStale?: boolean;
    chartCachedAt?: string;
  }
>();

function hasAgentChartSeries(agent: AgentBulkCache | null | undefined): boolean {
  return Boolean(
    agent?.seriesBySymbol && Object.values(agent.seriesBySymbol).some(s => s?.length)
  );
}

function agentChartStaleNote(cachedAtIso: string): string {
  return `Agent chart data is older than ${env.marketCacheTtlHours}h (saved ${cachedAtIso}). Run a fresh scrape in the Agent panel for updated LLM charts.`;
}

async function resolveAgentBulkWithAge(): Promise<{
  agent: AgentBulkCache;
  cachedAtMs: number;
  stale: boolean;
} | null> {
  const ttlMs = memoryCacheTtl.marketQuoteMs;

  const freshMem = getMemoryCached<AgentBulkCache>(agentBulkCacheKey(), ttlMs);
  if (hasAgentChartSeries(freshMem)) {
    const ts = getMemoryCachedAt(agentBulkCacheKey(), ttlMs);
    if (ts != null) {
      return { agent: freshMem!, cachedAtMs: ts, stale: false };
    }
  }

  const staleMem = getMemoryCachedStale<AgentBulkCache>(agentBulkCacheKey(), STALE_BULK_MAX_MS);
  if (hasAgentChartSeries(staleMem?.data)) {
    return { agent: staleMem!.data, cachedAtMs: staleMem!.timestamp, stale: true };
  }

  const fsFresh = await readAgentBulkFromFirestore();
  if (hasAgentChartSeries(fsFresh)) {
    const agent: AgentBulkCache = {
      quotes: fsFresh!.quotes,
      seriesBySymbol: normalizeSeriesBySymbol(fsFresh!.seriesBySymbol),
    };
    setMemoryCached(agentBulkCacheKey(), agent);
    return { agent, cachedAtMs: Date.now(), stale: false };
  }

  const fsStale = await readAgentBulkStaleFromFirestore(STALE_BULK_MAX_MS);
  if (hasAgentChartSeries(fsStale?.doc)) {
    const agent: AgentBulkCache = {
      quotes: fsStale!.doc.quotes,
      seriesBySymbol: normalizeSeriesBySymbol(fsStale!.doc.seriesBySymbol),
    };
    setMemoryCached(agentBulkCacheKey(), agent);
    const ageMs = Date.now() - fsStale!.timestamp;
    return {
      agent,
      cachedAtMs: fsStale!.timestamp,
      stale: ageMs >= ttlMs,
    };
  }

  return null;
}

function applyAgentChartMetaForBulk(
  agent: AgentBulkCache,
  cachedAtMs: number,
  stale: boolean
): void {
  const cachedAt = new Date(cachedAtMs).toISOString();
  const note = stale
    ? agentChartStaleNote(cachedAt)
    : '30-day chart from agent scrape cache.';
  for (const symbol of Object.keys(agent.seriesBySymbol ?? {})) {
    if (!agent.seriesBySymbol[symbol]?.length) continue;
    chartMetaBySymbol.set(symbol.toUpperCase(), {
      chartSource: AGENT_PROVIDER,
      chartStale: stale,
      chartCachedAt: cachedAt,
      chartNote: note,
    });
  }
}

/** Catalog metadata only in mock mode — live quotes stay pure Yahoo. */
function enrichQuote(quote: StockQuote): StockQuote {
  if (getMarketDataMode() === 'live') {
    return quote;
  }
  const catalog = findCatalogMetadata(quote.symbol);
  if (!catalog) return quote;
  return {
    ...quote,
    name: catalog.name,
    sector: catalog.sector,
    pe: catalog.pe,
    marketCap: catalog.marketCap,
    volume: quote.volume,
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
  stale?: boolean;
}

/** Drop per-symbol chart RAM so a new agent bulk/scrape is not masked by older hydrated series. */
export function clearAgentChartTimeseriesMemory(): void {
  for (const symbol of getAgentSymbols()) {
    const sym = symbol.toUpperCase();
    const tsKey = cacheKeyForMode(cacheKey('market', 'timeseries', sym));
    deleteMemoryCache(tsKey);
    chartMetaBySymbol.delete(sym);
  }
}

/** Hydrate agent LLM chart series from memory/Firestore into per-symbol timeseries keys. */
export async function loadAgentChartCacheIntoMarket(): Promise<AgentChartCacheLoadResult> {
  const resolved = await resolveAgentBulkWithAge();
  if (!resolved || !hasAgentChartSeries(resolved.agent)) {
    return { loaded: false, chartSymbols: 0 };
  }

  const { agent, cachedAtMs, stale } = resolved;
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
  applyAgentChartMetaForBulk(agent, cachedAtMs, stale);

  return {
    loaded: true,
    chartSymbols,
    cachedAt: new Date(cachedAtMs).toISOString(),
    stale,
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

/** Live/Mock quote bulk while dashboard is in agent mode — never use for LLM charts. */
function isAgentQuoteOnlyBulk(bundle: BulkStocksCache): boolean {
  if (getMarketDataMode() !== 'agent') return false;
  const p = bundle.meta.provider;
  return p !== AGENT_PROVIDER && p !== 'agent';
}

function hydrateBulkCache(bundle: BulkStocksCache): void {
  const normalized: BulkStocksCache = {
    ...bundle,
    seriesBySymbol: isAgentQuoteOnlyBulk(bundle)
      ? {}
      : normalizeSeriesBySymbol(bundle.seriesBySymbol),
  };
  setMemoryCached(bulkStocksCacheKey(), normalized);
  if (!isAgentQuoteOnlyBulk(bundle)) {
    hydrateChartSeriesFromBulk(normalized);
  }
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
    bulkFirestoreSlot(getMarketDataMode(), getQuoteDataMode()),
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
  '30-day chart preloaded with daily stock refresh (no extra Yahoo call).';

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

async function resolveAgentChartBulkOnly(): Promise<BulkStocksCache | null> {
  const resolved = await resolveAgentBulkWithAge();
  if (!resolved || !hasAgentChartSeries(resolved.agent)) {
    return null;
  }
  applyAgentChartMetaForBulk(resolved.agent, resolved.cachedAtMs, resolved.stale);
  return agentBulkToMarketBulk(resolved.agent, {
    dataMode: 'agent',
    provider: AGENT_PROVIDER,
    fetched: resolved.agent.quotes.length,
    failed: 0,
  });
}

async function resolveBulkCacheForCharts(): Promise<BulkStocksCache | null> {
  const mode = getMarketDataMode();
  if (mode === 'agent') {
    return resolveAgentChartBulkOnly();
  }

  const mem = getFreshBulkCache();
  if (mem && !isAgentQuoteOnlyBulk(mem)) return mem;

  const bulkSlot = bulkFirestoreSlot(mode, getQuoteDataMode());
  if (bulkSlot === 'live' || bulkSlot === 'mock' || bulkSlot === 'agent-live' || bulkSlot === 'agent-mock') {
    const fsDoc = await readBulkStocksFromFirestore(bulkSlot);
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

    const fsStale = await readBulkStocksStaleFromFirestore(bulkSlot, STALE_BULK_MAX_MS);
    if (fsStale?.bundle.stocks.length) {
      hydrateBulkCache(fsStale.bundle);
      return getFreshBulkCache();
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

function demoNewsArticles(): NewsArticle[] {
  return getDemoNewsArticles();
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
  } else if (marketModeUsesYahooLive(dataMode) && quotesCachedAt && !probe) {
    liveReachable = true;
  } else if (probe && marketModeUsesYahooLive(dataMode)) {
    const probeResult = await probeLiveProvider();
    liveReachable = probeResult.reachable;
    liveProbeError = probeResult.error;
  } else if (marketModeUsesYahooLive(dataMode) && !isLiveMarketConfigured()) {
    liveReachable = false;
    liveProbeError = liveMarketConfigError();
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
    marketModeUsesYahooLive(dataMode)
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
    agentScrapeSymbolLimit: env.agentScrapeSymbolLimit,
    cacheTtlHours: env.marketCacheTtlHours,
    quotesCachedAt,
    newsCachedAt,
  };
}

export function updateMarketDataMode(
  mode: MarketDataMode,
  quoteDataMode?: QuoteDataMode
): MarketDataSettings {
  if (mode !== 'live' && mode !== 'mock' && mode !== 'agent' && mode !== 'agent-v2') {
    throw new AppError('dataMode must be "live", "mock", "agent", or "agent-v2"', 400, 'INVALID_MARKET_MODE');
  }
  if (quoteDataMode && quoteDataMode !== 'live' && quoteDataMode !== 'mock') {
    throw new AppError('quoteDataMode must be "live" or "mock"', 400, 'INVALID_QUOTE_MODE');
  }
  applyMarketDataMode(mode);
  if (quoteDataMode) setQuoteDataMode(quoteDataMode);
  const provider =
    mode === 'live' || mode === 'agent-v2'
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
    agentScrapeSymbolLimit: env.agentScrapeSymbolLimit,
    cacheTtlHours: env.marketCacheTtlHours,
    quotesCachedAt: mode !== 'mock' ? quotesCachedAtIso() : undefined,
    newsCachedAt: mode !== 'mock' ? newsCachedAtIso() : undefined,
  };
}

/** Agent dashboard shows only symbols in the scrape job catalog slice. */
function agentDisplayStocks(quotes: StockQuote[]): StockQuote[] {
  const bySym = new Map(quotes.map(q => [q.symbol.toUpperCase(), enrichQuote(q)]));
  const out: StockQuote[] = [];
  for (const sym of getAgentSymbols()) {
    const q = bySym.get(sym.toUpperCase());
    if (q) out.push(q);
  }
  return out;
}

function agentStocksMeta(
  stocks: StockQuote[],
  extra: Omit<MarketFetchMeta, 'dataMode' | 'fetched'>
): MarketFetchMeta {
  return {
    dataMode: 'agent',
    fetched: stocks.length,
    agentSymbolLimit: env.agentScrapeSymbolLimit,
    ...extra,
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

  if (!env.liveChartOnDemand) {
    throw new AppError(
      `No live quote for ${symbol} yet. Wait for the daily stock refresh to finish or click Refresh.`,
      503,
      'MARKET_LIVE_UNAVAILABLE'
    );
  }

  const chartQuotes = await fetchYahooChartQuotes(symbol);
  const quote = enrichQuote(quoteFromYahooQuotes(symbol, chartQuotes));
  const tsKey = cacheKeyForMode(cacheKey('market', 'timeseries', symbol));
  setMemoryCached(tsKey, timeSeriesFromYahooQuotes(chartQuotes));
  chartMetaBySymbol.set(symbol, { chartSource: 'yahoo', chartNote: CHART_PRELOAD_NOTE });
  setMemoryCached(key, quote);
  return quote;
}

export async function getAllStocks(options?: {
  forceLive?: boolean;
  agentTier?: import('@investai/shared').AiCostTier;
  /** When agent delegates to live/mock fetch, persist under agent-* Firestore docs. */
  firestoreBulkSlot?: MarketBulkFirestoreSlot;
}): Promise<{
  stocks: StockQuote[];
  meta: MarketFetchMeta & { agentScrape?: import('@investai/shared').AgentScrapeUsage };
}> {
  const mode = getMarketDataMode();
  const firestoreSlot =
    options?.firestoreBulkSlot ?? bulkFirestoreSlot(mode, getQuoteDataMode());
  const cacheMeta = { cacheTtlHours: env.marketCacheTtlHours };

  if (options?.forceLive) {
    invalidateAgentScrapeCache();
  }

  logMarketStocks('request', {
    dataMode: mode,
    quoteDataMode: getQuoteDataMode(),
    forceLive: Boolean(options?.forceLive),
    bulkKey: bulkStocksCacheKey(),
    firestoreConfigured: env.isFirebaseConfigured(),
    instanceId: env.firebaseAppInstanceId,
  });

  if (marketModeUsesYahooLive(mode)) {
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
    const agentBulk = readAgentMemoryBulk();
    if (agentBulk?.quotes.length) {
      const stocks = agentDisplayStocks(agentBulk.quotes);
      return {
        stocks,
        meta: agentStocksMeta(stocks, {
          provider: AGENT_PROVIDER,
          failed: 0,
          fromCache: true,
          cacheSource: 'memory',
          cacheNote:
            'Stock list from last agent chart job (LLM-derived last close). Run Start for fresh 30-day charts.',
          seriesBySymbol: {},
        }),
      };
    }

    return withTemporaryQuoteMode(() => getAllStocks(options));
  }

  assertLiveMarketConfigured();

  const liveProvider = resolveLiveProvider();
  const providerSource: MarketStocksCacheSource = 'provider-yahoo';
  logMarketStocks('provider-fetch-start', {
    source: providerSource,
    provider: liveProvider,
    symbolCount: STOCK_SYMBOLS.length,
  });
  const bulk = await fetchYahooBulk(STOCK_SYMBOLS);
  const stockResults = bulk.quotes.map(enrichQuote);
  const providerLabel = 'Yahoo';

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

  const quoteOnlyAgentSlot = firestoreSlot.startsWith('agent-');
  const bulkBundle: BulkStocksCache = {
    stocks: stockResults,
    seriesBySymbol: quoteOnlyAgentSlot ? {} : seriesBySymbol,
    meta,
  };
  hydrateBulkCache(bulkBundle);
  void writeBulkStocksToFirestore(firestoreSlot, bulkBundle);
  logMarketStocks('provider-fetch-done', {
    source: providerSource,
    count: stockResults.length,
    failed: failedCount,
    wroteFirestore: env.isFirebaseConfigured(),
    docId: `${env.firebaseAppInstanceId}_${firestoreSlot}`,
  });

  assertLiveQuoteProvider(meta.provider, 'getAllStocks/live');
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

  if (mode === 'agent-v2') {
    return {
      articles: [],
      meta: {
        dataMode: 'agent-v2',
        provider: YAHOO_PROVIDER,
        count: 0,
        warnings: [
          'Agent v2 uses synthetic demo news per symbol on the Dashboard (cached 1 day). This tab does not fetch live news.',
        ],
      },
    };
  }

  if (mode === 'mock') {
    const articles = demoNewsArticles();
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

  const articles = demoNewsArticles();
  const meta: MarketNewsMeta = {
    dataMode: 'live',
    provider: YAHOO_PROVIDER,
    count: articles.length,
    fromCache: false,
    cachedAt: new Date().toISOString(),
    warnings: [
      'News from demo catalog — Yahoo Finance has no news feed in this app. Agent mode uses the same quote-source news path.',
    ],
    ...cacheMeta,
  };
  const bundle = { articles, meta };
  setMemoryCached(newsCacheKey(), bundle);
  void writeNewsToFirestore('live', bundle);
  return bundle;
}

export function getTimeSeriesMeta(symbol: string): Record<string, unknown> | undefined {
  return chartMetaBySymbol.get(symbol);
}

export async function getTimeSeriesDaily(symbol: string): Promise<TimeSeriesData[]> {
  const mode = getMarketDataMode();
  const sym = symbol.toUpperCase();
  const key = cacheKeyForMode(cacheKey('market', 'timeseries', sym));

  if (mode === 'mock') {
    const series = getMockTimeSeries(symbol);
    setMemoryCached(key, series);
    chartMetaBySymbol.delete(sym);
    return series;
  }

  if (mode === 'agent') {
    let resolved = await resolveAgentBulkWithAge();
    if (!resolved) {
      await loadAgentChartCacheIntoMarket();
      resolved = await resolveAgentBulkWithAge();
    }
    const fromBulk = resolved?.agent.seriesBySymbol?.[sym];
    if (fromBulk?.length && resolved) {
      setMemoryCached(key, fromBulk);
      const cachedAt = new Date(resolved.cachedAtMs).toISOString();
      chartMetaBySymbol.set(sym, {
        chartSource: AGENT_PROVIDER,
        chartStale: resolved.stale,
        chartCachedAt: cachedAt,
        chartNote: resolved.stale
          ? agentChartStaleNote(cachedAt)
          : '30-day chart from agent scrape job (LLM).',
      });
      return fromBulk;
    }
    throw new AppError(
      `No agent chart for ${symbol}. Start a 30-day chart scrape job in Agent mode (home tab).`,
      503,
      'MARKET_CHART_NOT_PRELOADED'
    );
  }

  const cached = getMemoryCached<TimeSeriesData[]>(key, memoryCacheTtl.marketTimeSeriesMs);
  if (cached) return cached;

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

  if (env.liveChartOnDemand) {
    try {
      const data = await fetchYahooTimeSeries(symbol);
      setMemoryCached(key, data);
      chartMetaBySymbol.set(symbol, {
        chartSource: liveProvider,
        chartNote: 'Chart fetched on demand from Yahoo Finance.',
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
    if (marketModeUsesYahooLive(mode)) {
      return {
        symbol: stock.symbol,
        name: stock.name || stock.symbol,
        price: stock.price,
        change: stock.change,
        pe: stock.pe ?? 0,
        marketCap: stock.marketCap ?? 'N/A',
      };
    }
    const catalog = findCatalogMetadata(stock.symbol);
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
  return probeYahooProvider();
}
