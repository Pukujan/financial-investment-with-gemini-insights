import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStockQuote, getMarketNews, getStockSectorInfo, StockQuote, NewsArticle } from '../services/financialApi';
import { AIInsights } from '../services/aiService';
import { getCachedAIInsights } from '../services/aiInsightsCache';

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

// Popular stocks across different sectors
const STOCK_SYMBOLS = [
  // Technology
  'AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'ADBE', 'CRM', 'ORCL', 'INTC', 'AMD',
  // Consumer Cyclical
  'AMZN', 'TSLA', 'NKE', 'MCD', 'SBUX', 'HD', 'LOW',
  // Communication Services
  'NFLX', 'DIS', 'CMCSA', 'T', 'VZ',
  // Healthcare
  'JNJ', 'UNH', 'PFE', 'ABBV', 'TMO', 'ABT', 'LLY',
  // Financial Services
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA',
  // Energy
  'XOM', 'CVX', 'COP', 'SLB',
  // Consumer Defensive
  'PG', 'KO', 'PEP', 'WMT', 'COST',
  // Industrials
  'BA', 'CAT', 'GE', 'UPS', 'HON', 'MMM',
  // Basic Materials
  'LIN', 'APD', 'NEM', 'FCX',
  // Real Estate
  'AMT', 'PLD', 'CCI', 'EQIX',
  // Utilities
  'NEE', 'DUK', 'SO', 'AEP',
  // Semiconductors
  'AVGO', 'TXN', 'QCOM', 'MU', 'AMAT',
  // Software
  'NOW', 'INTU', 'PANW', 'WDAY',
  // Retail
  'TGT', 'TJX', 'ROST',
  // Automotive
  'F', 'GM',
  // Aerospace
  'LMT', 'RTX', 'NOC',
  // Biotech
  'GILD', 'AMGN', 'REGN', 'VRTX'
];

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
      // Fetch stocks in batches of 4 and display them progressively
      const batchSize = 4;
      const stockResults: StockQuote[] = [];

      for (let i = 0; i < STOCK_SYMBOLS.length; i += batchSize) {
        const batch = STOCK_SYMBOLS.slice(i, i + batchSize);
        console.log(`Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(STOCK_SYMBOLS.length / batchSize)}: ${batch.join(', ')}`);

        const batchPromises = batch.map(symbol =>
          getStockQuote(symbol).catch(error => {
            console.error(`Failed to fetch ${symbol}:`, error);
            return null;
          })
        );
        const batchResults = await Promise.all(batchPromises);

        // Filter out null results AND stocks with price = 0 (API failures)
        const validResults = batchResults.filter((result): result is StockQuote =>
          result !== null && result.price > 0
        );

        stockResults.push(...validResults);

        console.log(`✓ Batch complete: ${validResults.length}/${batch.length} stocks loaded successfully`);

        // Update UI immediately with current batch
        setStocks([...stockResults]);

        // Stop showing loading spinner after first batch
        if (i === 0 && validResults.length > 0) {
          setLoading(false);
        }

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < STOCK_SYMBOLS.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`\u2713 Total stocks loaded: ${stockResults.length}/${STOCK_SYMBOLS.length}`);

      // Fetch all news (up to 80 articles)
      console.log('Fetching news articles...');
      const newsData = await getMarketNews('all', 80);
      setNews(newsData);
      console.log(`Loaded ${newsData.length} news articles`);

      // Dashboard data is ready
      setLastUpdated(new Date());

      // Check if we have cached AI insights first (30 minute cache)
      const instanceId = import.meta.env.VITE_FIREBASE_APP_INSTANCE_ID || 'default';
      let hasCachedInsights = false;

      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const docRef = doc(db, 'aiInsights', instanceId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const cached = docSnap.data();
          const age = Date.now() - (cached.lastUpdated || 0);
          const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
          hasCachedInsights = age < CACHE_DURATION;
        }
      } catch (error) {
        console.log('Unable to check cache, will generate new insights after data loads');
      }

      // If we have cached insights, fetch them immediately
      // Otherwise, wait for all stocks AND news to load before generating
      if (hasCachedInsights) {
        console.log('Loading cached AI insights...');
        const topStocks = stockResults.slice(0, 8);
        const enrichedStockData = topStocks.map(stock => {
          return {
            symbol: stock.symbol,
            name: stock.name || stock.symbol,
            price: stock.price,
            change: stock.change,
            pe: 0,
            marketCap: 'N/A',
          };
        });

        const insights = await getCachedAIInsights(enrichedStockData, newsData);
        setAiInsights(insights);
        setAiLoading(false);
      } else {
        console.log('Generating AI insights with stocks and news data...');
        // Wait for all stocks to be loaded (check if we have the expected count)
        if (stockResults.length >= STOCK_SYMBOLS.length * 0.9) { // Allow 10% failure rate
          console.log(`All data loaded: ${stockResults.length} stocks, ${newsData.length} news articles`);
          const topStocks = stockResults.slice(0, 8);
          const enrichedStockData = topStocks.map(stock => {
            return {
              symbol: stock.symbol,
              name: stock.name || stock.symbol,
              price: stock.price,
              change: stock.change,
              pe: 0,
              marketCap: 'N/A',
            };
          });

          const insights = await getCachedAIInsights(enrichedStockData, newsData);
          setAiInsights(insights);
          setAiLoading(false);
        } else {
          console.log(`Only ${stockResults.length}/${STOCK_SYMBOLS.length} stocks loaded, skipping AI insights generation`);
          setAiLoading(false);
        }
      }
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
