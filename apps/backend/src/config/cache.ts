/** Central cache TTLs and Firestore collection names */

import { env } from './env.js';

const marketTtlMs = env.marketCacheTtlHours * 60 * 60 * 1000;

export const memoryCacheTtl = {
  /** Live Yahoo quotes, news, charts — default 24h (once per day) */
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
  /** Daily market bulk quotes + chart series (survives Railway restarts). */
  marketBulk: 'marketBulkCache',
  marketNews: 'marketNewsCache',
  /** Agent scrape bulk quotes + 30d chart series. */
  agentBulk: 'agentBulkCache',
  agentNews: 'agentNewsCache',
  ragChunks: 'ragChunks',
  ragRetrievalLogs: 'ragRetrievalLogs',
  promptEval: 'promptEvalExperiments',
  promptAb: 'promptAbExperiments',
  chartEval: 'chartEvalRuns',
  estimateEval: 'estimateEvalRuns',
  portfolioPrefix: (instanceId: string) => `portfolios_${instanceId}`,
} as const;

export const marketFirestoreTtlMs = marketTtlMs;
