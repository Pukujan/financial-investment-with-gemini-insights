/** Central cache TTLs and Firestore collection names */

import { env } from './env.js';

const marketTtlMs = env.marketCacheTtlHours * 60 * 60 * 1000;

export const memoryCacheTtl = {
  /** Live Tiingo quotes, news, charts — default 24h (once per day) */
  marketQuoteMs: marketTtlMs,
  marketNewsMs: marketTtlMs,
  marketTimeSeriesMs: marketTtlMs,
} as const;

export const firestoreCacheTtl = {
  aiInsightsMs: 15 * 60 * 1000,
  stockPredictionMs: 24 * 60 * 60 * 1000,
} as const;

export const firestoreCollections = {
  aiInsights: 'aiInsights',
  stockPredictions: 'stockPredictions',
  portfolioPrefix: (instanceId: string) => `portfolios_${instanceId}`,
} as const;
