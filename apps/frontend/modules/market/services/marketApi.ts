import type {
  AiCostTier,
  MarketDataMode,
  MarketDataSettings,
  NewsArticle,
  QuoteDataMode,
  StockQuote,
} from '@investai/shared';
import { http, httpWithMeta } from '../../../shared/api/http';

export const marketApi = {
  getSettings: (probe = false) =>
    http<MarketDataSettings>(`/api/market/settings${probe ? '?probe=1' : ''}`),

  setDataMode: (dataMode: MarketDataMode, quoteDataMode?: QuoteDataMode) =>
    http<MarketDataSettings>('/api/market/settings', {
      method: 'PUT',
      body: JSON.stringify(
        quoteDataMode != null ? { dataMode, quoteDataMode } : { dataMode }
      ),
    }),

  getStocks: (options?: { forceLive?: boolean; agentTier?: AiCostTier }) => {
    const params = new URLSearchParams();
    if (options?.forceLive) params.set('forceLive', '1');
    if (options?.agentTier) params.set('agentTier', options.agentTier);
    const qs = params.toString();
    return httpWithMeta<StockQuote[]>(`/api/market/stocks${qs ? `?${qs}` : ''}`);
  },

  getNews: (options?: { agentTier?: AiCostTier }) => {
    const params = new URLSearchParams();
    if (options?.agentTier) params.set('agentTier', options.agentTier);
    const qs = params.toString();
    return httpWithMeta<NewsArticle[]>(`/api/market/news${qs ? `?${qs}` : ''}`);
  },
};
