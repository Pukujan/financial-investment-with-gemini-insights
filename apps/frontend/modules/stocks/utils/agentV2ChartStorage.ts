import type { TimeSeriesData } from '@investai/shared';
import {
  isMarketStockBundleFresh,
  loadMarketStockBundle,
} from '@/modules/market/utils/marketStockStorage';

/** Agent v2 shares the Live mode Yahoo bulk cache (quotes + 30-day series). */
export function loadAgentV2ChartSeries(symbol: string): {
  series: TimeSeriesData[];
  note: string;
  fromCache: boolean;
  stale: boolean;
} | null {
  const sym = symbol.toUpperCase();
  const bundle = loadMarketStockBundle({ dataMode: 'live' });
  if (!bundle) return null;

  const series = bundle.seriesBySymbol?.[sym];
  if (!series?.length) return null;

  const fresh = isMarketStockBundleFresh(bundle);
  return {
    series,
    fromCache: true,
    stale: !fresh,
    note: fresh
      ? '30-day chart from Yahoo Finance (shared Live browser cache).'
      : '30-day chart from Yahoo Finance (stale Live cache — Yahoo may be rate-limiting; try Refresh in Live mode first).',
  };
}
