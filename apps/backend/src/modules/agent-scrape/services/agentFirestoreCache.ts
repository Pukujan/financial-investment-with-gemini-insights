import type { NewsArticle, StockQuote, TimeSeriesData } from '@investai/shared';
import { env } from '../../../config/env.js';
import { firestoreCollections, marketFirestoreTtlMs } from '../../../config/cache.js';
import {
  deleteFirestoreCache,
  readFirestoreCache,
  readFirestoreCacheStale,
  writeFirestoreCache,
} from '../../../utils/firestoreCache.js';

export interface AgentBulkDoc {
  quotes: StockQuote[];
  seriesBySymbol: Record<string, TimeSeriesData[]>;
}

function agentDocId(): string {
  return env.firebaseAppInstanceId;
}

export async function readAgentBulkFromFirestore(): Promise<AgentBulkDoc | null> {
  return readFirestoreCache<AgentBulkDoc>(
    firestoreCollections.agentBulk,
    agentDocId(),
    marketFirestoreTtlMs
  );
}

export async function readAgentBulkStaleFromFirestore(
  maxStaleMs: number
): Promise<{ doc: AgentBulkDoc; timestamp: number } | null> {
  const hit = await readFirestoreCacheStale<AgentBulkDoc>(
    firestoreCollections.agentBulk,
    agentDocId(),
    maxStaleMs
  );
  if (!hit) return null;
  return { doc: hit.data, timestamp: hit.timestamp };
}

export async function writeAgentBulkToFirestore(doc: AgentBulkDoc): Promise<void> {
  await writeFirestoreCache(firestoreCollections.agentBulk, agentDocId(), {
    quotes: doc.quotes,
    seriesBySymbol: doc.seriesBySymbol,
  });
}

export async function readAgentNewsFromFirestore(): Promise<NewsArticle[] | null> {
  const hit = await readFirestoreCache<{ articles: NewsArticle[] }>(
    firestoreCollections.agentNews,
    agentDocId(),
    marketFirestoreTtlMs
  );
  return hit?.articles?.length ? hit.articles : null;
}

export async function writeAgentNewsToFirestore(articles: NewsArticle[]): Promise<void> {
  await writeFirestoreCache(firestoreCollections.agentNews, agentDocId(), { articles });
}

export async function deleteAgentFirestoreCaches(): Promise<void> {
  const docId = agentDocId();
  await Promise.all([
    deleteFirestoreCache(firestoreCollections.agentBulk, docId),
    deleteFirestoreCache(firestoreCollections.agentNews, docId),
  ]);
}
