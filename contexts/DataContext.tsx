import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStockQuote, getMarketNews, StockQuote, NewsArticle } from '../services/financialApi';
import { AIInsights } from '../services/aiService';
import { getCachedAIInsights } from '../services/aiInsightsCache';
import { mockStocks } from '../data/mockData';

interface DataContextType {
  stocks: StockQuote[];
  news: NewsArticle[];
  aiInsights: AIInsights | null;
  loading: boolean;
  aiLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Use all stocks from mockData - simulating real API data
const STOCK_SYMBOLS = mockStocks.map(s => s.symbol);

export function DataProvider({ children }: { children: ReactNode }) {
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchAllData = async () => {
    setLoading(true);
    setAiLoading(true);
    setError(null);

    try {
      // Fetch all stocks from Yahoo Finance API in batches to avoid overwhelming the API
      const batchSize = 10;
      const stockResults: StockQuote[] = [];

      for (let i = 0; i < STOCK_SYMBOLS.length; i += batchSize) {
        const batch = STOCK_SYMBOLS.slice(i, i + batchSize);
        const batchPromises = batch.map(symbol =>
          getStockQuote(symbol).catch(error => {
            console.error(`Failed to fetch ${symbol}:`, error);
            return null;
          })
        );
        const batchResults = await Promise.all(batchPromises);
        stockResults.push(...batchResults.filter((result): result is StockQuote => result !== null));

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < STOCK_SYMBOLS.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setStocks(stockResults);

      // Fetch news
      const newsData = await getMarketNews();
      setNews(newsData);
      
      // Dashboard data is ready - stop loading for main UI
      setLoading(false);
      setLastUpdated(new Date());

      // Fetch AI insights in the background (non-blocking)
      // Prepare stock data with additional fields for AI insights
      // Use only the first 8 stocks to avoid overwhelming the AI API
      const topStocks = stockResults.slice(0, 8);
      const enrichedStockData = topStocks.map(stock => {
        const mockData = mockStocks.find(s => s.symbol === stock.symbol);
        return {
          symbol: stock.symbol,
          name: mockData?.name || stock.symbol,
          price: stock.price,
          change: stock.change,
          pe: mockData?.pe || 0,
          marketCap: mockData?.marketCap || 'N/A',
        };
      });

      // Get AI insights with caching (non-blocking)
      // Will use cached data if less than 15 minutes old
      const insights = await getCachedAIInsights(enrichedStockData, newsData);
      setAiInsights(insights);
      setAiLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setLoading(false);
      setAiLoading(false);
    }
  };

  const refreshData = async () => {
    await fetchAllData();
  };

  // Initial data fetch on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  return (
    <DataContext.Provider
      value={{
        stocks,
        news,
        aiInsights,
        loading,
        aiLoading,
        error,
        lastUpdated,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
