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
import { logMarketStocks } from './marketCacheLog.js';
import type { BulkStocksCache, NewsCacheBundle } from './marketCacheTypes.js';

function marketDocId(mode: MarketDataMode): string {
  return `${env.firebaseAppInstanceId}_${mode}`;
}

export async function readBulkStocksFromFirestore(
  mode: MarketDataMode
): Promise<BulkStocksCache | null> {
  const docId = marketDocId(mode);
  if (!env.isFirebaseConfigured()) {
    logMarketStocks('firestore-read-skip', {
      reason: 'firebase-not-configured',
      collection: firestoreCollections.marketBulk,
      docId,
    });
    return null;
  }

  const fresh = await readFirestoreCache<BulkStocksCache>(
    firestoreCollections.marketBulk,
    docId,
    marketFirestoreTtlMs
  );
  if (fresh?.stocks?.length) {
    logMarketStocks('firestore-read-ok', {
      source: 'firestore-fresh',
      docId,
      stockCount: fresh.stocks.length,
      lastUpdated: (fresh as BulkStocksCache & { lastUpdated?: number }).lastUpdated,
    });
    return fresh;
  }

  const staleProbe = await readFirestoreCacheStale<BulkStocksCache>(
    firestoreCollections.marketBulk,
    docId,
    marketFirestoreTtlMs * 2
  );
  if (staleProbe) {
    const ageMs = Date.now() - staleProbe.timestamp;
    logMarketStocks('firestore-read-expired', {
      docId,
      ageMs,
      ttlMs: marketFirestoreTtlMs,
      stockCount: staleProbe.data.stocks?.length ?? 0,
      reason: ageMs >= marketFirestoreTtlMs ? 'past-ttl' : 'empty-or-missing-stocks',
    });
  } else {
    logMarketStocks('firestore-read-miss', {
      docId,
      reason: 'document-missing-or-read-denied',
    });
  }

  return null;
}

export async function writeBulkStocksToFirestore(
  mode: MarketDataMode,
  bundle: BulkStocksCache
): Promise<void> {
  const docId = marketDocId(mode);
  if (!env.isFirebaseConfigured()) {
    logMarketStocks('firestore-write-skip', {
      reason: 'firebase-not-configured',
      docId,
      stockCount: bundle.stocks.length,
    });
    return;
  }
  await writeFirestoreCache(firestoreCollections.marketBulk, docId, {
    stocks: bundle.stocks,
    seriesBySymbol: bundle.seriesBySymbol,
    meta: bundle.meta,
  });
  logMarketStocks('firestore-write-ok', {
    docId,
    stockCount: bundle.stocks.length,
    seriesSymbols: Object.keys(bundle.seriesBySymbol ?? {}).length,
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
