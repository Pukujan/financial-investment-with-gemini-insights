import type { MarketDataMode } from '@investai/shared';
import type { QuoteDataMode } from '../../../config/marketDataMode.js';

/** Firestore `marketBulkCache` document suffix — live vs agent quote caches are separate. */
export type MarketBulkFirestoreSlot = 'live' | 'mock' | 'agent-live' | 'agent-mock';

/** Memory/Firestore bulk keys follow quote source when dashboard is in agent mode. */
export function effectiveMarketCacheMode(
  dataMode: MarketDataMode,
  quoteDataMode: QuoteDataMode
): MarketDataMode {
  if (dataMode === 'agent') return quoteDataMode;
  return dataMode;
}

export function bulkFirestoreSlot(
  dataMode: MarketDataMode,
  quoteDataMode: QuoteDataMode
): MarketBulkFirestoreSlot {
  if (dataMode === 'agent') {
    return quoteDataMode === 'live' ? 'agent-live' : 'agent-mock';
  }
  if (dataMode === 'mock') return 'mock';
  return 'live';
}
