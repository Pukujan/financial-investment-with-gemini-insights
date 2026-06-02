import type { MarketDataMode } from '@investai/shared';

const LIVE_ERROR_CODES = new Set([
  'MARKET_LIVE_UNAVAILABLE',
  'MARKET_NEWS_FORBIDDEN',
  'MARKET_NEWS_UNAVAILABLE',
  'MARKET_CHART_NOT_PRELOADED',
]);

const LIVE_WARNING_PATTERN =
  /yahoo|live market|live news|live chart|rate limit|stock_fetch_limit/i;

/** In agent mode, only show agent-scrape (and generic) status — not live quote failures. */
export function filterStatusForDataMode(
  dataMode: MarketDataMode,
  error: string | null,
  errorCode: string | null,
  warnings: string[]
): { error: string | null; errorCode: string | null; warnings: string[] } {
  if (dataMode !== 'agent') {
    return { error, errorCode, warnings };
  }

  const showError =
    error && errorCode && !LIVE_ERROR_CODES.has(errorCode) ? error : null;
  const showCode = showError ? errorCode : null;
  const filteredWarnings = warnings.filter(w => !LIVE_WARNING_PATTERN.test(w));

  return {
    error: showError,
    errorCode: showCode,
    warnings: filteredWarnings,
  };
}
