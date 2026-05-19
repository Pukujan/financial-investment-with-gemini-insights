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
import type { MarketBulkFirestoreSlot } from './marketCacheMode.js';
import type { BulkStocksCache, NewsCacheBundle } from './marketCacheTypes.js';

function marketBulkDocId(slot: MarketBulkFirestoreSlot): string {
  return `${env.firebaseAppInstanceId}_${slot}`;
}

function marketNewsDocId(mode: MarketDataMode): string {
  return `${env.firebaseAppInstanceId}_${mode}`;
}

export async function readBulkStocksFromFirestore(
  slot: MarketBulkFirestoreSlot
): Promise<BulkStocksCache | null> {
  const docId = marketBulkDocId(slot);
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
  slot: MarketBulkFirestoreSlot,
  bundle: BulkStocksCache
): Promise<void> {
  const docId = marketBulkDocId(slot);
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
  slot: MarketBulkFirestoreSlot,
  maxStaleMs: number
): Promise<{ bundle: BulkStocksCache; timestamp: number } | null> {
  const hit = await readFirestoreCacheStale<BulkStocksCache>(
    firestoreCollections.marketBulk,
    marketBulkDocId(slot),
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
    marketNewsDocId(mode),
    marketFirestoreTtlMs
  );
}

export async function writeNewsToFirestore(
  mode: MarketDataMode,
  bundle: NewsCacheBundle
): Promise<void> {
  await writeFirestoreCache(firestoreCollections.marketNews, marketNewsDocId(mode), {
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
    marketNewsDocId(mode),
    maxStaleMs
  );
  if (!hit) return null;
  return hit.data;
}

export async function deleteMarketFirestoreCache(mode: MarketDataMode): Promise<void> {
  const newsId = marketNewsDocId(mode);
  const bulkIds: string[] =
    mode === 'agent'
      ? [marketBulkDocId('agent-live'), marketBulkDocId('agent-mock')]
      : [marketBulkDocId(mode === 'mock' ? 'mock' : 'live')];

  await Promise.all([
    ...bulkIds.map(docId => deleteFirestoreCache(firestoreCollections.marketBulk, docId)),
    deleteFirestoreCache(firestoreCollections.marketNews, newsId),
  ]);
}

export async function deleteAllMarketFirestoreCaches(): Promise<void> {
  const { deleteAgentFirestoreCaches } = await import(
    '../../agent-scrape/services/agentFirestoreCache.js'
  );
  const bulkSlots: MarketBulkFirestoreSlot[] = ['live', 'mock', 'agent-live', 'agent-mock'];
  await Promise.all([
    ...bulkSlots.map(slot =>
      deleteFirestoreCache(firestoreCollections.marketBulk, marketBulkDocId(slot))
    ),
    deleteFirestoreCache(firestoreCollections.marketNews, marketNewsDocId('live')),
    deleteFirestoreCache(firestoreCollections.marketNews, marketNewsDocId('mock')),
    deleteFirestoreCache(firestoreCollections.marketNews, marketNewsDocId('agent')),
    deleteAgentFirestoreCaches(),
  ]);
}
