import type { MarketDataMode } from '@investai/shared';
import { env } from '../../../config/env.js';
import {
  firestoreCollections,
  marketFirestoreTtlMs,
} from '../../../config/cache.js';
import {
  deleteFirestoreCache,
  readFirestoreCache,
  readFirestoreCacheStale,
  writeFirestoreCache,
} from '../../../utils/firestoreCache.js';
import type { BulkStocksCache, NewsCacheBundle } from './marketCacheTypes.js';

function marketDocId(mode: MarketDataMode): string {
  return `${env.firebaseAppInstanceId}_${mode}`;
}

export async function readBulkStocksFromFirestore(
  mode: MarketDataMode
): Promise<BulkStocksCache | null> {
  return readFirestoreCache<BulkStocksCache>(
    firestoreCollections.marketBulk,
    marketDocId(mode),
    marketFirestoreTtlMs
  );
}

export async function writeBulkStocksToFirestore(
  mode: MarketDataMode,
  bundle: BulkStocksCache
): Promise<void> {
  await writeFirestoreCache(firestoreCollections.marketBulk, marketDocId(mode), {
    stocks: bundle.stocks,
    seriesBySymbol: bundle.seriesBySymbol,
    meta: bundle.meta,
  });
}

export async function readBulkStocksStaleFromFirestore(
  mode: MarketDataMode,
  maxStaleMs: number
): Promise<{ bundle: BulkStocksCache; timestamp: number } | null> {
  const hit = await readFirestoreCacheStale<BulkStocksCache>(
    firestoreCollections.marketBulk,
    marketDocId(mode),
    maxStaleMs
  );
  if (!hit) return null;
  return { bundle: hit.data, timestamp: hit.timestamp };
}

export async function readNewsFromFirestore(
  mode: MarketDataMode
): Promise<NewsCacheBundle | null> {
  return readFirestoreCache<NewsCacheBundle>(
    firestoreCollections.marketNews,
    marketDocId(mode),
    marketFirestoreTtlMs
  );
}

export async function writeNewsToFirestore(
  mode: MarketDataMode,
  bundle: NewsCacheBundle
): Promise<void> {
  await writeFirestoreCache(firestoreCollections.marketNews, marketDocId(mode), {
    articles: bundle.articles,
    meta: bundle.meta,
  });
}

export async function readNewsStaleFromFirestore(
  mode: MarketDataMode,
  maxStaleMs: number
): Promise<NewsCacheBundle | null> {
  const hit = await readFirestoreCacheStale<NewsCacheBundle>(
    firestoreCollections.marketNews,
    marketDocId(mode),
    maxStaleMs
  );
  if (!hit) return null;
  return hit.data;
}

export async function deleteMarketFirestoreCache(mode: MarketDataMode): Promise<void> {
  const docId = marketDocId(mode);
  await Promise.all([
    deleteFirestoreCache(firestoreCollections.marketBulk, docId),
    deleteFirestoreCache(firestoreCollections.marketNews, docId),
  ]);
}

export async function deleteAllMarketFirestoreCaches(): Promise<void> {
  const { deleteAgentFirestoreCaches } = await import(
    '../../agent-scrape/services/agentFirestoreCache.js'
  );
  await Promise.all([
    deleteMarketFirestoreCache('live'),
    deleteMarketFirestoreCache('mock'),
    deleteMarketFirestoreCache('agent'),
    deleteAgentFirestoreCaches(),
  ]);
}
