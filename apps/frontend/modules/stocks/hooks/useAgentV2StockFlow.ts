import { useCallback, useState } from 'react';
import type { CachedDemoMarketNews, SevenDayPrediction, TimeSeriesData } from '@investai/shared';
import { AGENT_V2_COMPANY_NAMES } from '@investai/shared';
import { getOrCreateDemoMarketNewsForSymbol } from '../services/getOrCreateDemoMarketNewsService';
import { generateSevenDayPrediction } from '../services/sevenDayPredictionService';
import { normalizeTimeSeriesToOHLCV } from '../services/stockTrendAnalysisService';

export function useAgentV2StockFlow() {
  const [demoNews, setDemoNews] = useState<CachedDemoMarketNews | null>(null);
  const [prediction, setPrediction] = useState<SevenDayPrediction | null>(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const loadDemoNews = useCallback(async (symbol: string, timeSeries: TimeSeriesData[]) => {
    setLoadingNews(true);
    setNewsError(null);
    setDemoNews(null);
    setPrediction(null);

    try {
      const history = normalizeTimeSeriesToOHLCV(timeSeries);
      if (!history.length) {
        setNewsError('30-day market data unavailable.');
        return null;
      }

      const companyName = AGENT_V2_COMPANY_NAMES[symbol.toUpperCase()] ?? symbol;
      const payload = await getOrCreateDemoMarketNewsForSymbol({
        symbol,
        companyName,
        history,
      });
      if (!payload) {
        setNewsError('30-day market data unavailable.');
        return null;
      }
      setDemoNews(payload);
      return payload;
    } catch {
      setNewsError('Failed to load synthetic demo news.');
      return null;
    } finally {
      setLoadingNews(false);
    }
  }, []);

  const loadPrediction = useCallback(
    async (symbol: string, cached?: CachedDemoMarketNews | null) => {
      setLoadingPrediction(true);
      try {
        const news = cached ?? demoNews;
        const result = generateSevenDayPrediction({
          symbol,
          companyName: news?.companyName ?? AGENT_V2_COMPANY_NAMES[symbol.toUpperCase()] ?? symbol,
          trend: news?.trend ?? null,
          cachedNews: news,
        });
        setPrediction(result);
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
    setNewsError(null);
  }, []);

  return {
    demoNews,
    prediction,
    loadingNews,
    loadingPrediction,
    newsError,
    loadDemoNews,
    loadPrediction,
    reset,
  };
}
