/**
 * Browser console helper for stock load source (from API meta).
 * Stocks are never read from localStorage — only server cache / live provider.
 */
export function logStockCacheFromApi(
  event: string,
  meta: Record<string, unknown> | undefined,
  stockCount: number
): void {
  const cacheSource =
    typeof meta?.cacheSource === 'string' ? meta.cacheSource : meta?.fromCache ? 'cached-unknown' : 'live-fetch';
  const cacheNote = typeof meta?.cacheNote === 'string' ? meta.cacheNote : undefined;

  console.info(`[market-stocks] ${event}`, {
    stockCount,
    cacheSource,
    fromCache: meta?.fromCache,
    cachedAt: meta?.cachedAt,
    dataMode: meta?.dataMode,
    provider: meta?.provider,
    cacheNote,
    warnings: meta?.warnings,
    clientNote:
      'Stocks: localStorage live vs agent-* (12h) → API → server RAM → Firestore (live vs agent-live) → Yahoo.',
  });
}
