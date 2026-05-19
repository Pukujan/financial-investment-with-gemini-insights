import type { MarketDataMode } from '@investai/shared';
import type { QuoteDataMode } from '../../../config/marketDataMode.js';

/** Memory/Firestore bulk keys follow quote source when dashboard is in agent mode. */
export function effectiveMarketCacheMode(
  dataMode: MarketDataMode,
  quoteDataMode: QuoteDataMode
): MarketDataMode {
  if (dataMode === 'agent') return quoteDataMode;
  return dataMode;
}
