import type { CachedDemoMarketNews, SevenDayPrediction } from '@investai/shared';
import { generateSevenDayPrediction } from './sevenDayPredictionService';
import {
  getCachedSevenDayPrediction,
  isSevenDayPredictionCacheValid,
  setCachedSevenDayPrediction,
  SEVEN_DAY_PREDICTION_CACHE_TTL_MS,
} from './sevenDayPredictionCacheService';

export function getOrCreateSevenDayPredictionForSymbol(input: {
  symbol: string;
  companyName: string;
  cachedNews: CachedDemoMarketNews;
  forceRegenerate?: boolean;
}): SevenDayPrediction {
  const symbol = input.symbol.toUpperCase();
  const newsGeneratedAt = input.cachedNews.generatedAt;

  if (!input.forceRegenerate) {
    const cached = getCachedSevenDayPrediction(symbol);
    if (isSevenDayPredictionCacheValid(cached, symbol, newsGeneratedAt) && cached) {
      return cached.prediction;
    }
  }

  const prediction = generateSevenDayPrediction({
    symbol,
    companyName: input.companyName,
    trend: input.cachedNews.trend,
    cachedNews: input.cachedNews,
  });

  const generatedAt = new Date().toISOString();
  setCachedSevenDayPrediction(symbol, {
    symbol,
    promptVersion: 'v2',
    generatedAt,
    expiresAt: new Date(Date.now() + SEVEN_DAY_PREDICTION_CACHE_TTL_MS).toISOString(),
    newsGeneratedAt,
    prediction,
  });

  return prediction;
}
