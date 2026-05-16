import type { MarketDataMode, MarketDataSettings, NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import { mockNews, mockStocks } from '../../../data/mockData.js';
import { memoryCacheTtl } from '../../../config/cache.js';
import { env } from '../../../config/env.js';
import { getMarketDataMode, setMarketDataMode } from '../../../config/marketDataMode.js';
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
  AGENT_PROVIDER,
  agentScrapeConfigError,
  fetchAgentMarketNews,
  getAgentBulkCached,
  getAgentSymbols,
  getLastAgentBatchError,
  invalidateAgentScrapeCache,
  isAgentScrapeConfigured,
} from '../../agent-scrape/services/agentScrapeService.js';

const ALL_SYMBOLS = mockStocks.map(s => s.symbol);
const STOCK_SYMBOLS =
  env.stockFetchLimit > 0 ? ALL_SYMBOLS.slice(0, env.stockFetchLimit) : ALL_SYMBOLS;
const STALE_BULK_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const NEWS_CACHE_KEY = 'feed';

export interface MarketFetchMeta {
  dataMode: MarketDataMode;
  provider: typeof TIINGO_PROVIDER | typeof AGENT_PROVIDER | typeof MOCK_PROVIDER;
  fetched: number;
  failed: number;
  failedSymbols?: string[];
  warnings?: string[];
  fromCache?: boolean;
  cachedAt?: string;
  cacheTtlHours?: number;
}

export interface MarketNewsMeta {
  dataMode: MarketDataMode;
  provider: typeof TIINGO_PROVIDER | typeof AGENT_PROVIDER | typeof MOCK_PROVIDER;
  count: number;
  fromCache?: boolean;
  cachedAt?: string;
  cacheTtlHours?: number;
  warnings?: string[];
}

interface BulkStocksCache {
  stocks: StockQuote[];
  /** Preloaded 30d charts — avoids per-click Tiingo calls (see Tiingo EOD best practices). */
  seriesBySymbol: Record<string, TimeSeriesData[]>;
  meta: MarketFetchMeta;
}

interface NewsCacheBundle {
  articles: NewsArticle[];
  meta: MarketNewsMeta;
}

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
  return `${baseKey}:${getMarketDataMode()}`;
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

export function invalidateMarketCache(): void {
  deleteMemoryCacheByPrefix('market:');
  invalidateAgentScrapeCache();
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

function tryStaleBulkCache(warning: string): {
  stocks: StockQuote[];
  meta: MarketFetchMeta;
} | null {
  const stale = getMemoryCachedStale<BulkStocksCache>(
    bulkStocksCacheKey(),
    STALE_BULK_MAX_MS
  );
  if (!stale) return null;

  return {
    stocks: stale.data.stocks,
    meta: {
      ...stale.data.meta,
      dataMode: 'live',
      provider: TIINGO_PROVIDER,
      fromCache: true,
      cachedAt: new Date(stale.timestamp).toISOString(),
      cacheTtlHours: env.marketCacheTtlHours,
      warnings: [warning],
    },
  };
}

function tryStaleNewsCache(warning: string): NewsCacheBundle | null {
  const stale = getMemoryCachedStale<NewsCacheBundle>(newsCacheKey(), STALE_BULK_MAX_MS);
  if (!stale) return null;

  return {
    articles: stale.data.articles,
    meta: {
      ...stale.data.meta,
      dataMode: 'live',
      provider: TIINGO_PROVIDER,
      count: stale.data.articles.length,
      fromCache: true,
      cachedAt: new Date(stale.timestamp).toISOString(),
      cacheTtlHours: env.marketCacheTtlHours,
      warnings: [warning],
    },
  };
}

const CHART_PRELOAD_NOTE =
  '30-day chart preloaded with daily stock refresh (no extra Tiingo call).';

function seriesMapToRecord(
  seriesBySymbol: Map<string, TimeSeriesData[]>
): Record<string, TimeSeriesData[]> {
  return Object.fromEntries(seriesBySymbol);
}

function cacheTiingoSeries(seriesBySymbol: Map<string, TimeSeriesData[]>): void {
  for (const [symbol, series] of seriesBySymbol) {
    const key = cacheKeyForMode(cacheKey('market', 'timeseries', symbol));
    setMemoryCached(key, series);
    chartMetaBySymbol.set(symbol, {
      chartSource: 'tiingo',
      chartNote: CHART_PRELOAD_NOTE,
    });
  }
}

function getFreshBulkCache(): BulkStocksCache | null {
  return getMemoryCached<BulkStocksCache>(
    bulkStocksCacheKey(),
    memoryCacheTtl.marketQuoteMs
  );
}

function getPreloadedTimeSeries(symbol: string): TimeSeriesData[] | null {
  const sym = symbol.toUpperCase();
  const fresh = getFreshBulkCache()?.seriesBySymbol[sym];
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
  const fresh = getFreshBulkCache()?.stocks.find(s => s.symbol === sym);
  if (fresh) return fresh;

  const stale = getMemoryCachedStale<BulkStocksCache>(
    bulkStocksCacheKey(),
    STALE_BULK_MAX_MS
  );
  return stale?.data.stocks.find(s => s.symbol === sym) ?? null;
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
    const probeResult = await probeTiingoProvider();
    liveReachable = probeResult.reachable;
    liveProbeError = probeResult.error;
  } else if (dataMode === 'agent') {
    liveReachable = isAgentScrapeConfigured();
    if (!liveReachable) liveProbeError = agentScrapeConfigError();
  }

  const provider =
    dataMode === 'live'
      ? TIINGO_PROVIDER
      : dataMode === 'agent'
        ? AGENT_PROVIDER
        : MOCK_PROVIDER;

  return {
    dataMode,
    provider,
    liveReachable,
    liveProbeError,
    stockFetchLimit: env.stockFetchLimit,
    cacheTtlHours: env.marketCacheTtlHours,
    quotesCachedAt,
    newsCachedAt,
  };
}

export function updateMarketDataMode(mode: MarketDataMode): MarketDataSettings {
  if (mode !== 'live' && mode !== 'mock' && mode !== 'agent') {
    throw new AppError('dataMode must be "live", "mock", or "agent"', 400, 'INVALID_MARKET_MODE');
  }
  setMarketDataMode(mode);
  const provider =
    mode === 'live' ? TIINGO_PROVIDER : mode === 'agent' ? AGENT_PROVIDER : MOCK_PROVIDER;
  return {
    dataMode: mode,
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
    assertAgentScrapeConfigured();
    const fromBulk = findQuoteInBulkCache(symbol);
    if (fromBulk) {
      const enriched = enrichQuote(fromBulk);
      setMemoryCached(key, enriched);
      return enriched;
    }
    throw new AppError(
      `No agent quote for ${symbol} yet. Click Refresh to run agent scrape.`,
      503,
      'AGENT_SCRAPE_FAILED'
    );
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
    invalidateMarketCache();
  }

  if (options?.forceLive) {
    invalidateAgentScrapeCache();
  }

  if (mode === 'live') {
    const bulkKey = bulkStocksCacheKey();
    const cached = getMemoryCached<BulkStocksCache>(bulkKey, memoryCacheTtl.marketQuoteMs);
    if (cached && !options?.refresh) {
      return {
        stocks: cached.stocks,
        meta: {
          ...cached.meta,
          fromCache: true,
          cachedAt: quotesCachedAtIso(),
          ...cacheMeta,
        },
      };
    }
  }

  if (mode === 'mock') {
    const stocks = getAllMockQuotes(STOCK_SYMBOLS);
    return {
      stocks,
      meta: {
        dataMode: 'mock',
        provider: MOCK_PROVIDER,
        fetched: stocks.length,
        failed: 0,
      },
    };
  }

  if (mode === 'agent') {
    assertAgentScrapeConfigured();
    const agentSymbols = getAgentSymbols();
    const { bulk, usage } = await getAgentBulkCached(agentSymbols, {
      refresh: options?.refresh,
      forceLive: options?.forceLive,
      tier: options?.agentTier,
    });
    const stockResults = bulk.quotes.map(enrichQuote);
    const failedSymbols = agentSymbols.filter(
      s => !stockResults.some(q => q.symbol === s)
    );

    if (stockResults.length === 0) {
      const detail = getLastAgentBatchError();
      throw new AppError(
        detail
          ? `Agent scrape failed: ${detail}`
          : 'Agent scrape returned no quotes. Confirm a live scrape or check OPENROUTER_API_KEY.',
        503,
        'AGENT_SCRAPE_FAILED'
      );
    }

    const meta: MarketFetchMeta & { agentScrape: typeof usage } = {
      dataMode: 'agent',
      provider: AGENT_PROVIDER,
      fetched: stockResults.length,
      failed: failedSymbols.length,
      failedSymbols: failedSymbols.length > 0 ? failedSymbols : undefined,
      warnings:
        failedSymbols.length > 0
          ? [`${failedSymbols.length} symbols missing from agent scrape`]
          : usage.fromCache
            ? ['Agent quotes from cache — 0 tokens used on this load']
            : ['Agent-estimated quotes via OpenRouter — not exchange feed data'],
      fromCache: usage.fromCache,
      cachedAt: new Date().toISOString(),
      agentScrape: usage,
      ...cacheMeta,
    };

    setMemoryCached(bulkStocksCacheKey(), {
      stocks: stockResults,
      seriesBySymbol: bulk.seriesBySymbol,
      meta,
    });

    return { stocks: stockResults, meta };
  }

  assertLiveMarketConfigured();

  const bulk = await fetchTiingoBulk(STOCK_SYMBOLS);
  const stockResults = bulk.quotes.map(enrichQuote);

  for (const enriched of stockResults) {
    setMemoryCached(
      cacheKeyForMode(cacheKey('market', 'quote', enriched.symbol)),
      enriched
    );
  }

  const failedCount = bulk.failedSymbols.length;

  if (stockResults.length === 0) {
    const stale = tryStaleBulkCache(
      'Could not reach Tiingo. Showing last cached live prices if available.'
    );
    if (stale) return stale;

    throw new AppError(liveMarketFetchError(), 503, 'MARKET_LIVE_UNAVAILABLE');
  }

  const warnings =
    failedCount > 0
      ? [
          `${failedCount} symbols could not be loaded from Tiingo`,
          ...(failedCount <= 10 ? [bulk.failedSymbols.join(', ')] : []),
        ]
      : undefined;

  const meta: MarketFetchMeta = {
    dataMode: 'live',
    provider: TIINGO_PROVIDER,
    fetched: stockResults.length,
    failed: failedCount,
    failedSymbols: failedCount > 0 ? bulk.failedSymbols : undefined,
    warnings,
    fromCache: false,
    cachedAt: new Date().toISOString(),
    ...cacheMeta,
  };

  const seriesBySymbol = seriesMapToRecord(bulk.seriesBySymbol);
  cacheTiingoSeries(bulk.seriesBySymbol);
  setMemoryCached(bulkStocksCacheKey(), {
    stocks: stockResults,
    seriesBySymbol,
    meta,
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
    assertAgentScrapeConfigured();
    try {
      const newsLimit = Math.min(10, env.tiingoNewsLimit);
      const { articles, usage } = await fetchAgentMarketNews(newsLimit, {
        tier: options?.agentTier,
      });
      const meta: MarketNewsMeta = {
        dataMode: 'agent',
        provider: AGENT_PROVIDER,
        count: articles.length,
        fromCache: usage.totalTokens === 0,
        cachedAt: new Date().toISOString(),
        warnings: [
          usage.totalTokens === 0
            ? 'Agent news from cache — 0 tokens'
            : `Agent news scrape used ~${usage.totalTokens} tokens`,
          'Agent-generated news — verify before trading decisions',
        ],
        ...cacheMeta,
      };
      const bundle = { articles, meta };
      setMemoryCached(newsCacheKey(), bundle);
      return bundle;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      throw new AppError(
        `Agent news scrape failed: ${detail}`,
        503,
        'AGENT_SCRAPE_FAILED'
      );
    }
  }

  assertLiveMarketConfigured();

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
    return bundle;
  } catch (error) {
    console.warn('Tiingo news failed:', error);
    const stale = tryStaleNewsCache(
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
    assertAgentScrapeConfigured();
    const preloaded = getPreloadedTimeSeries(symbol);
    if (preloaded) {
      setMemoryCached(key, preloaded);
      chartMetaBySymbol.set(symbol, {
        chartSource: 'agent',
        chartNote: 'Chart derived from agent-scraped quote (estimated series).',
      });
      return preloaded;
    }
    throw new AppError(
      `Chart for ${symbol} not loaded. Refresh stocks in Agent mode first.`,
      503,
      'MARKET_CHART_NOT_PRELOADED'
    );
  }

  assertLiveMarketConfigured();

  const preloaded = getPreloadedTimeSeries(symbol);
  if (preloaded) {
    setMemoryCached(key, preloaded);
    chartMetaBySymbol.set(symbol, {
      chartSource: 'tiingo',
      chartNote: CHART_PRELOAD_NOTE,
    });
    return preloaded;
  }

  if (env.tiingoChartOnDemand) {
    try {
      const data = await fetchTiingoTimeSeries(symbol);
      setMemoryCached(key, data);
      chartMetaBySymbol.set(symbol, {
        chartSource: 'tiingo',
        chartNote: 'Chart fetched on demand from Tiingo (uses API quota).',
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
    `Chart for ${symbol} is not loaded yet. Wait for the daily stock refresh to finish (dashboard stocks list), then open the chart again — no per-click Tiingo calls.`,
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
  return probeTiingoProvider();
}
