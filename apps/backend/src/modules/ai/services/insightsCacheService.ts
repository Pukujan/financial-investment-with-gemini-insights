import type { AIInsights, MarketDataMode } from '@investai/shared';
import { env } from '../../../config/env.js';
import { firestoreCacheTtl, firestoreCollections } from '../../../config/cache.js';
import { getMarketDataMode } from '../../../config/marketDataMode.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { readFirestoreCache, writeFirestoreCache } from '../../../utils/firestoreCache.js';
import * as marketService from '../../market/services/marketService.js';
import { generateAIInsights } from './aiService.js';

interface CachedInsightsDoc {
  insights: AIInsights;
  lastUpdated: number;
  createdAt: number;
}

export interface AIInsightsMeta {
  dataMode: MarketDataMode;
  fromCache: boolean;
  cachedAt?: string;
  stocksAnalyzed: number;
  newsArticlesUsed: number;
  warnings: string[];
}

export interface AIInsightsResult {
  insights: AIInsights;
  meta: AIInsightsMeta;
}

function isMarketUnavailable(error: unknown): boolean {
  return error instanceof AppError && error.statusCode >= 500;
}

export async function getAIInsights(): Promise<AIInsights> {
  const { insights } = await getAIInsightsWithMeta();
  return insights;
}

export async function getAIInsightsWithMeta(
  options?: { bypassCache?: boolean }
): Promise<AIInsightsResult> {
  const mode = getMarketDataMode();
  const docId = env.firebaseAppInstanceId;
  const warnings: string[] = [];

  if (!options?.bypassCache) {
    const cached = await readFirestoreCache<CachedInsightsDoc>(
      firestoreCollections.aiInsights,
      docId,
      firestoreCacheTtl.aiInsightsMs,
      'lastUpdated'
    );

    if (cached?.insights) {
      return {
        insights: cached.insights,
        meta: {
          dataMode: mode,
          fromCache: true,
          cachedAt: new Date(cached.lastUpdated).toISOString(),
          stocksAnalyzed: cached.insights.stats.stocksAnalyzed,
          newsArticlesUsed: 0,
          warnings: [],
        },
      };
    }
  }

  const strict = mode === 'live'; // agent + mock allow AI fallback

  let stocks: Awaited<ReturnType<typeof marketService.getAllStocks>>['stocks'] = [];
  try {
    const stockResult = await marketService.getAllStocks();
    stocks = stockResult.stocks;
    if (stockResult.meta.warnings?.length) {
      warnings.push(...stockResult.meta.warnings);
    }
    if (stocks.length === 0) {
      throw new AppError(
        'No stock data available for AI analysis. Load live stocks first or switch to Mock mode.',
        503,
        'AI_INSUFFICIENT_MARKET_DATA'
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Could not load stocks for AI insights: ${error instanceof Error ? error.message : 'Unknown error'}`,
      503,
      'MARKET_DATA_UNAVAILABLE'
    );
  }

  let newsArticlesUsed = 0;
  let newsInput: Array<{ title: string; summary: string; sentiment: string }> = [];

  if (mode === 'live') {
    try {
      const newsBundle = await marketService.getMarketNewsWithMeta();
      newsArticlesUsed = newsBundle.articles.length;
      newsInput = newsBundle.articles.map(n => ({
        title: n.title,
        summary: n.summary,
        sentiment: n.sentiment,
      }));
      if (newsBundle.meta.warnings?.length) {
        warnings.push(...newsBundle.meta.warnings);
      }
      if (newsArticlesUsed === 0) {
        warnings.push(
          'No live news articles available — insights will use stock data only.'
        );
      }
    } catch (error) {
      if (isMarketUnavailable(error)) {
        const message =
          error instanceof AppError
            ? error.message
            : 'Live news unavailable for AI insights';
        warnings.push(message);
        if (error instanceof AppError && error.code === 'MARKET_LIVE_UNAVAILABLE') {
          warnings.push(
            'Generating insights from stock data only until a live news provider is configured.'
          );
        }
      } else {
        throw error;
      }
    }
  } else {
    const newsBundle = await marketService.getMarketNewsWithMeta();
    newsArticlesUsed = newsBundle.articles.length;
    newsInput = newsBundle.articles.map(n => ({
      title: n.title,
      summary: n.summary,
      sentiment: n.sentiment,
    }));
  }

  const enriched = marketService.getEnrichedStockInputs(stocks);
  const insights = await generateAIInsights(enriched, newsInput.length ? newsInput : undefined, {
    strict,
  });

  const cachedAt = new Date().toISOString();
  await writeFirestoreCache(firestoreCollections.aiInsights, docId, {
    insights,
    lastUpdated: Date.now(),
    createdAt: Date.now(),
  });

  return {
    insights,
    meta: {
      dataMode: mode,
      fromCache: false,
      cachedAt,
      stocksAnalyzed: enriched.length,
      newsArticlesUsed,
      warnings,
    },
  };
}

/** @deprecated Use getAIInsights */
export const getCachedAIInsights = getAIInsights;
