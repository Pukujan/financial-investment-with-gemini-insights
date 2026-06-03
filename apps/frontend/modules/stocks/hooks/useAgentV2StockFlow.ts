import { useCallback, useState } from 'react';
import type { CachedDemoMarketNews, SevenDayPrediction, TimeSeriesData } from '@investai/shared';
import { AGENT_V2_COMPANY_NAMES } from '@investai/shared';
import {
  getCachedDemoMarketNews,
  isDemoMarketNewsCacheValid,
} from '../services/demoMarketNewsCacheService';
import { clearSevenDayPredictionCache } from '../services/sevenDayPredictionCacheService';
import { getOrCreateDemoMarketNewsForSymbol } from '../services/getOrCreateDemoMarketNewsService';
import { getOrCreateSevenDayPredictionForSymbol } from '../services/getOrCreateSevenDayPredictionService';
import {
  getCachedSevenDayPrediction,
  isSevenDayPredictionCacheValid,
} from '../services/sevenDayPredictionCacheService';
import { normalizeTimeSeriesToOHLCV } from '../services/stockTrendAnalysisService';

export function useAgentV2StockFlow() {
  const [demoNews, setDemoNews] = useState<CachedDemoMarketNews | null>(null);
  const [prediction, setPrediction] = useState<SevenDayPrediction | null>(null);
  const [predictionExpiresAt, setPredictionExpiresAt] = useState<string | null>(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [timeSeriesRef, setTimeSeriesRef] = useState<TimeSeriesData[]>([]);

  const restoreCachedForSymbol = useCallback((symbol: string) => {
    const sym = symbol.toUpperCase();
    const news = getCachedDemoMarketNews(sym);
    if (isDemoMarketNewsCacheValid(news, sym) && news) {
      setDemoNews(news);
      const predCache = getCachedSevenDayPrediction(sym);
      if (isSevenDayPredictionCacheValid(predCache, sym, news.generatedAt) && predCache) {
        setPrediction(predCache.prediction);
        setPredictionExpiresAt(predCache.expiresAt);
      } else {
        setPrediction(null);
        setPredictionExpiresAt(null);
      }
    } else {
      setDemoNews(null);
      setPrediction(null);
      setPredictionExpiresAt(null);
    }
    setNewsError(null);
  }, []);

  const bindChartSeries = useCallback(
    (symbol: string, timeSeries: TimeSeriesData[]) => {
      setTimeSeriesRef(timeSeries);
      restoreCachedForSymbol(symbol);
    },
    [restoreCachedForSymbol]
  );

  const generateDemoNews = useCallback(
    async (symbol: string, timeSeries?: TimeSeriesData[], forceRegenerate = false) => {
      const series = timeSeries?.length ? timeSeries : timeSeriesRef;
      setLoadingNews(true);
      setNewsError(null);
      if (forceRegenerate) {
        setPrediction(null);
        setPredictionExpiresAt(null);
        clearSevenDayPredictionCache(symbol.toUpperCase());
      }

      try {
        const history = normalizeTimeSeriesToOHLCV(series);
        if (!history.length) {
          setNewsError('30-day market data unavailable. Open Live mode once to preload Yahoo charts, then return to Agent v2.');
          return null;
        }

        const companyName = AGENT_V2_COMPANY_NAMES[symbol.toUpperCase()] ?? symbol;
        const payload = await getOrCreateDemoMarketNewsForSymbol({
          symbol,
          companyName,
          history,
          forceRegenerate,
        });
        if (!payload) {
          setNewsError('30-day market data unavailable.');
          return null;
        }
        setDemoNews(payload);
        return payload;
      } catch {
        setNewsError('Failed to generate synthetic demo news.');
        return null;
      } finally {
        setLoadingNews(false);
      }
    },
    [timeSeriesRef]
  );

  const loadPrediction = useCallback(
    async (symbol: string, cached?: CachedDemoMarketNews | null, forceRegenerate = false) => {
      const news = cached ?? demoNews;
      if (!news) {
        setNewsError('Generate demo news for this symbol first.');
        return null;
      }

      setLoadingPrediction(true);
      try {
        const result = getOrCreateSevenDayPredictionForSymbol({
          symbol,
          companyName: news.companyName,
          cachedNews: news,
          forceRegenerate,
        });
        const predCache = getCachedSevenDayPrediction(symbol.toUpperCase());
        setPrediction(result);
        setPredictionExpiresAt(predCache?.expiresAt ?? null);
        return result;
      } finally {
        setLoadingPrediction(false);
      }
    },
    [demoNews]
  );

  const reset = useCallback(() => {
    setDemoNews(null);
    setPrediction(null);
    setPredictionExpiresAt(null);
    setNewsError(null);
    setTimeSeriesRef([]);
  }, []);

  return {
    demoNews,
    prediction,
    predictionExpiresAt,
    loadingNews,
    loadingPrediction,
    newsError,
    bindChartSeries,
    generateDemoNews,
    loadPrediction,
    restoreCachedForSymbol,
    reset,
  };
};
