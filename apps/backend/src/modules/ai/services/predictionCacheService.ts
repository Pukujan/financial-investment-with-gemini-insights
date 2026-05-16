import type { StockPrediction } from '@investai/shared';
import { env } from '../../../config/env.js';
import { firestoreCacheTtl, firestoreCollections } from '../../../config/cache.js';
import { readFirestoreCache, writeFirestoreCache } from '../../../utils/firestoreCache.js';
import { generateStockPrediction } from './aiService.js';

interface CachedPredictionDoc {
  prediction: StockPrediction;
  historicalData: Array<{ date: string; price: number }>;
  createdAt: number;
  lastUpdated: number;
}

export async function getCachedStockPrediction(
  symbol: string,
  historicalData: Array<{ date: string; price: number }>
): Promise<StockPrediction> {
  const docId = `${env.firebaseAppInstanceId}_${symbol}`;

  const cached = await readFirestoreCache<CachedPredictionDoc>(
    firestoreCollections.stockPredictions,
    docId,
    firestoreCacheTtl.stockPredictionMs,
    'createdAt'
  );

  if (cached?.prediction) {
    return cached.prediction;
  }

  const prediction = await generateStockPrediction(symbol, historicalData);

  await writeFirestoreCache(firestoreCollections.stockPredictions, docId, {
    prediction,
    historicalData,
  });

  return prediction;
}
