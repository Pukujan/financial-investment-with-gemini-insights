import { formatRagContextBlock } from '@investai/prompts';
import { mockNews, mockStocks } from '../../../data/mockData.js';
import { firestoreCollections } from '../../../config/cache.js';
import { readFirestoreCache, writeFirestoreCache } from '../../../utils/firestoreCache.js';
import { env } from '../../../config/env.js';

export interface RagChunk {
  id: string;
  symbol: string;
  text: string;
  source: 'catalog' | 'news';
  asOf: string;
}

const MEMORY_CHUNKS: RagChunk[] = [];
const RAG_DOC_ID = 'chunks';
const RAG_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildDefaultChunks(): RagChunk[] {
  const now = new Date().toISOString();
  const chunks: RagChunk[] = [];

  for (const stock of mockStocks) {
    chunks.push({
      id: `catalog-${stock.symbol}`,
      symbol: stock.symbol,
      text: `${stock.name} (${stock.symbol}) — sector ${stock.sector}, market cap ${stock.marketCap}, P/E ${stock.pe}. Use as company context only; prices must come from extraction or golden reference.`,
      source: 'catalog',
      asOf: now,
    });
  }

  for (const article of mockNews.slice(0, 12)) {
    for (const ticker of article.relatedStocks) {
      chunks.push({
        id: `news-${ticker}-${article.title.slice(0, 12).replace(/\W/g, '')}`,
        symbol: ticker,
        text: `${article.title}. ${article.summary} Sentiment: ${article.sentiment}.`,
        source: 'news',
        asOf: now,
      });
    }
  }

  return chunks;
}

export async function ensureRagIndex(): Promise<RagChunk[]> {
  if (MEMORY_CHUNKS.length > 0) return MEMORY_CHUNKS;

  const cached = await readFirestoreCache<{ chunks: RagChunk[] }>(
    firestoreCollections.ragChunks,
    env.firebaseAppInstanceId,
    RAG_TTL_MS
  );
  if (cached?.chunks?.length) {
    MEMORY_CHUNKS.push(...cached.chunks);
    return MEMORY_CHUNKS;
  }

  const built = buildDefaultChunks();
  MEMORY_CHUNKS.push(...built);
  await writeFirestoreCache(firestoreCollections.ragChunks, env.firebaseAppInstanceId, {
    chunks: built,
  });
  return MEMORY_CHUNKS;
}

/** Symbol-tagged retrieval (keyword filter) for quote/insights prompts. */
export async function retrieveRagForSymbols(
  symbols: string[],
  limitPerSymbol = 2
): Promise<{ chunks: RagChunk[]; contextBlock: string }> {
  const index = await ensureRagIndex();
  const want = new Set(symbols.map(s => s.toUpperCase()));
  const picked: RagChunk[] = [];

  for (const sym of want) {
    const hits = index.filter(c => c.symbol === sym).slice(0, limitPerSymbol);
    picked.push(...hits);
  }

  const contextBlock = formatRagContextBlock(picked);

  return { chunks: picked, contextBlock };
}
