/** Where stock bulk/quotes were loaded from (API meta + server logs). */
export type MarketStocksCacheSource =
  | 'memory'
  | 'firestore-fresh'
  | 'firestore-stale'
  | 'memory-stale'
  | 'provider-yahoo'
  | 'mock-catalog'
  | 'agent-memory'
  | 'agent-firestore'
  | 'cache-invalidated'
  | 'miss';

export type YahooChartCacheSource =
  | 'memory'
  | 'bulk-preload'
  | 'provider-yahoo'
  | 'miss';

const STOCK_SOURCE_NOTES: Record<MarketStocksCacheSource, string> = {
  memory: 'Server RAM (same Node process as last fetch). Not shared across devices.',
  'firestore-fresh': 'Firestore marketBulkCache within MARKET_CACHE_TTL_HOURS. Shared across devices on this API.',
  'firestore-stale': 'Firestore bulk past TTL but within 7-day stale window.',
  'memory-stale': 'Server RAM past TTL but within stale window.',
  'provider-yahoo': 'Live fetch from Yahoo Finance; writing Firestore if configured.',
  'mock-catalog': 'Static mock catalog (no network).',
  'agent-memory': 'Agent scrape bulk in server RAM.',
  'agent-firestore': 'Agent scrape bulk in Firestore.',
  'cache-invalidated': 'Client sent refresh=1 — memory + Firestore market caches cleared.',
  miss: 'No cache hit; will try provider or return empty.',
};

export function marketStocksCacheNote(source: MarketStocksCacheSource): string {
  return STOCK_SOURCE_NOTES[source];
}

export function logMarketStocks(
  event: string,
  detail: Record<string, unknown> & { source?: MarketStocksCacheSource }
): void {
  const note =
    detail.source != null ? marketStocksCacheNote(detail.source as MarketStocksCacheSource) : undefined;
  console.log('[market-stocks]', event, note ? { ...detail, note } : detail);
}

export function logYahooChart(
  event: string,
  detail: Record<string, unknown> & { source?: YahooChartCacheSource }
): void {
  console.log('[market-yahoo-chart]', event, detail);
}
