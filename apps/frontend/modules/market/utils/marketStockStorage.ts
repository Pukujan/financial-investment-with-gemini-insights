import type {
  MarketStockLocalBundle,
  MarketDataMode,
  PromptEvalGroundTruthPayload,
  QuoteDataMode,
  StockQuote,
  TimeSeriesData,
} from '@investai/shared';
import { MARKET_STOCK_CACHE_MS } from '@investai/shared';

/** Live dashboard quotes — separate from agent-mode quote cache. */
const LIVE_STORAGE_KEY = 'investai-market-stocks-live-v2';
/** Legacy key (pre-split); migrated into live on read. */
const LEGACY_STORAGE_KEY = 'investai-market-stocks-v2';

function agentStorageKey(quoteMode: QuoteDataMode): string {
  return `investai-market-stocks-agent-${quoteMode}-v1`;
}

export interface MarketStockStorageTarget {
  dataMode: MarketDataMode;
  quoteDataMode?: QuoteDataMode;
}

function resolveStorageKey(target: MarketStockStorageTarget): string | null {
  if (target.dataMode === 'live' || target.dataMode === 'agent-v2') return LIVE_STORAGE_KEY;
  if (target.dataMode === 'agent') {
    const quote = target.quoteDataMode ?? 'live';
    return agentStorageKey(quote);
  }
  return null;
}

export function isMarketStockBundleFresh(
  bundle: MarketStockLocalBundle | null,
  maxAgeMs = MARKET_STOCK_CACHE_MS
): boolean {
  if (!bundle?.cachedAt || !bundle.stocks?.length) return false;
  const t = Date.parse(bundle.cachedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < maxAgeMs;
}

function parseBundle(raw: string): MarketStockLocalBundle | null {
  try {
    const parsed = JSON.parse(raw) as MarketStockLocalBundle;
    if (!parsed?.stocks?.length || typeof parsed.cachedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadMarketStockBundle(target: MarketStockStorageTarget): MarketStockLocalBundle | null {
  const key = resolveStorageKey(target);
  if (!key) return null;

  try {
    const raw = localStorage.getItem(key);
    if (raw) return parseBundle(raw);

    if (target.dataMode === 'live') {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const bundle = parseBundle(legacy);
        if (bundle) {
          localStorage.setItem(LIVE_STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          console.info('[market-stocks] migrated legacy localStorage → live');
          return bundle;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function clearMarketStockBundle(target: MarketStockStorageTarget): void {
  const key = resolveStorageKey(target);
  if (!key) return;
  try {
    localStorage.removeItem(key);
    console.info('[market-stocks] localStorage cleared', { key });
  } catch {
    /* ignore */
  }
}

/** Stale agent-live bundles often held a full live catalog before symbol cap. */
export function isAgentStockBundleOversized(
  bundle: MarketStockLocalBundle,
  agentSymbolLimit: number
): boolean {
  return agentSymbolLimit > 0 && bundle.stocks.length > agentSymbolLimit;
}

export function saveMarketStockBundle(
  target: MarketStockStorageTarget,
  bundle: MarketStockLocalBundle
): void {
  const key = resolveStorageKey(target);
  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(bundle));
    console.info('[market-stocks] localStorage saved', {
      key,
      stockCount: bundle.stocks.length,
      seriesSymbols: Object.keys(bundle.seriesBySymbol ?? {}).length,
      cachedAt: bundle.cachedAt,
      cacheSource: bundle.cacheSource,
    });
  } catch (err) {
    console.warn('[market-stocks] localStorage save failed', err);
  }
}

export function buildGroundTruthFromLocalBundle(
  symbols: string[]
): PromptEvalGroundTruthPayload | null {
  const live = loadMarketStockBundle({ dataMode: 'live' });
  const bundle =
    live && isMarketStockBundleFresh(live)
      ? live
      : (() => {
          const agentV2 = loadMarketStockBundle({ dataMode: 'agent-v2' });
          if (agentV2 && isMarketStockBundleFresh(agentV2)) return agentV2;
          const agentLive = loadMarketStockBundle({ dataMode: 'agent', quoteDataMode: 'live' });
          return agentLive && isMarketStockBundleFresh(agentLive) ? agentLive : null;
        })();

  if (!bundle) {
    console.warn('[market-stocks] no fresh localStorage ground truth for eval', {
      hasLive: Boolean(live),
      liveCachedAt: live?.cachedAt,
    });
    return null;
  }

  const refs: PromptEvalGroundTruthPayload['symbols'] = [];
  const seriesBySymbol: Record<string, TimeSeriesData[]> = {};

  for (const sym of symbols) {
    const upper = sym.toUpperCase();
    const quote = bundle.stocks.find(s => s.symbol.toUpperCase() === upper);
    if (!quote) continue;
    refs.push({
      symbol: upper,
      yahooClose: quote.price,
      yahooPreviousClose: quote.previousClose,
    });
    const series = bundle.seriesBySymbol[upper];
    if (series?.length) seriesBySymbol[upper] = series;
  }

  if (refs.length === 0) return null;

  return {
    cachedAt: bundle.cachedAt,
    source: 'localStorage',
    symbols: refs,
    seriesBySymbol,
  };
}
