import type {
  MarketStockLocalBundle,
  PromptEvalGroundTruthPayload,
  StockQuote,
  TimeSeriesData,
} from '@investai/shared';
import { MARKET_STOCK_CACHE_MS } from '@investai/shared';

const STORAGE_KEY = 'investai-market-stocks-v2';

export function isMarketStockBundleFresh(
  bundle: MarketStockLocalBundle | null,
  maxAgeMs = MARKET_STOCK_CACHE_MS
): boolean {
  if (!bundle?.cachedAt || !bundle.stocks?.length) return false;
  const t = Date.parse(bundle.cachedAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < maxAgeMs;
}

export function loadMarketStockBundle(): MarketStockLocalBundle | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketStockLocalBundle;
    if (!parsed?.stocks?.length || typeof parsed.cachedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMarketStockBundle(bundle: MarketStockLocalBundle): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    console.info('[market-stocks] localStorage saved', {
      stockCount: bundle.stocks.length,
      seriesSymbols: Object.keys(bundle.seriesBySymbol ?? {}).length,
      cachedAt: bundle.cachedAt,
      cacheSource: bundle.cacheSource,
    });
  } catch (err) {
    console.warn('[market-stocks] localStorage save failed', err);
  }
}

export function clearMarketStockBundle(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.info('[market-stocks] localStorage cleared');
  } catch {
    /* ignore */
  }
}

export function buildGroundTruthFromLocalBundle(
  symbols: string[]
): PromptEvalGroundTruthPayload | null {
  const bundle = loadMarketStockBundle();
  if (!bundle || !isMarketStockBundleFresh(bundle)) {
    console.warn('[market-stocks] no fresh localStorage ground truth for eval', {
      hasBundle: Boolean(bundle),
      cachedAt: bundle?.cachedAt,
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
