import type { CachedDemoMarketNews, StockOHLCVPoint } from '@investai/shared';
import { AGENT_V2_PROMPT_VERSION } from '@investai/shared';
import {
  DEMO_MARKET_NEWS_CACHE_TTL_MS,
  getCachedDemoMarketNews,
  isDemoMarketNewsCacheValid,
  isTrendCompatibleWithCache,
  setCachedDemoMarketNews,
} from './demoMarketNewsCacheService';
import { generateDemoMarketNewsFromTrend } from './demoMarketNewsGenerationService';
import { analyzeThirtyDayTrend } from './stockTrendAnalysisService';

export async function getOrCreateDemoMarketNewsForSymbol(input: {
  symbol: string;
  companyName: string;
  history: StockOHLCVPoint[];
}): Promise<CachedDemoMarketNews | null> {
  const symbol = input.symbol.toUpperCase();
  const trend = analyzeThirtyDayTrend(symbol, input.history);
  if (!trend) return null;

  const cached = getCachedDemoMarketNews(symbol);
  if (
    isDemoMarketNewsCacheValid(cached, symbol) &&
    cached &&
    isTrendCompatibleWithCache(
      cached,
      trend.momentum,
      trend.priceChangePercent,
      trend.volumeTrend
    )
  ) {
    return cached;
  }

  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + DEMO_MARKET_NEWS_CACHE_TTL_MS).toISOString();
  const items = generateDemoMarketNewsFromTrend({
    symbol,
    companyName: input.companyName,
    trend,
  });

  const payload: CachedDemoMarketNews = {
    symbol,
    companyName: input.companyName,
    promptVersion: AGENT_V2_PROMPT_VERSION,
    generatedAt,
    expiresAt,
    trend,
    items,
  };

  setCachedDemoMarketNews(symbol, payload);
  return payload;
}
