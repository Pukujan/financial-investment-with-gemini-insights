// Yahoo Finance API with CORS proxy - No API key required
const CORS_PROXY = 'https://corsproxy.io/?';
const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance';

// FMP API for news only
const FMP_API_KEY = import.meta.env.VITE_FMP_API_KEY;
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

// Import AI service for news categorization and ticker extraction
import { categorizeNewsArticle, extractStockTickers } from './aiService';

if (!FMP_API_KEY) {
  console.error('❌ FMP_API_KEY is not set in .env file (needed for news only)');
} else {
  console.log('✓ FMP API Key loaded for news:', FMP_API_KEY.substring(0, 10) + '...');
}

// Circuit breaker to prevent excessive failed API calls
let failedCallsCount = 0;
const MAX_FAILED_CALLS = 10;
let isCircuitBroken = false;

function checkCircuitBreaker() {
  if (isCircuitBroken) {
    throw new Error('Circuit breaker activated: Too many API failures. Please check your FMP API key.');
  }
}

function recordFailure() {
  failedCallsCount++;
  if (failedCallsCount >= MAX_FAILED_CALLS) {
    isCircuitBroken = true;
    console.error(`❌ Circuit breaker activated after ${MAX_FAILED_CALLS} failed API calls. Stopping further requests.`);
  }
}

// 84 tracked stock symbols for news filtering
const TRACKED_SYMBOLS = [
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

// Hardcoded sector mapping for tracked stocks
const STOCK_SECTORS: Record<string, { name: string; sector: string; industry: string }> = {
  // Technology
  'AAPL': { name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics' },
  'MSFT': { name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software' },
  'GOOGL': { name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services' },
  'META': { name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Social Media' },
  'NVDA': { name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors' },
  'AMD': { name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors' },
  'INTC': { name: 'Intel Corporation', sector: 'Technology', industry: 'Semiconductors' },
  'CSCO': { name: 'Cisco Systems', sector: 'Technology', industry: 'Networking' },
  'ORCL': { name: 'Oracle Corporation', sector: 'Technology', industry: 'Software' },
  'ADBE': { name: 'Adobe Inc.', sector: 'Technology', industry: 'Software' },
  'CRM': { name: 'Salesforce Inc.', sector: 'Technology', industry: 'Software' },
  'AVGO': { name: 'Broadcom Inc.', sector: 'Technology', industry: 'Semiconductors' },
  'QCOM': { name: 'Qualcomm Inc.', sector: 'Technology', industry: 'Semiconductors' },
  'TXN': { name: 'Texas Instruments', sector: 'Technology', industry: 'Semiconductors' },
  'IBM': { name: 'IBM', sector: 'Technology', industry: 'IT Services' },

  // Finance
  'JPM': { name: 'JPMorgan Chase', sector: 'Finance', industry: 'Banking' },
  'BAC': { name: 'Bank of America', sector: 'Finance', industry: 'Banking' },
  'WFC': { name: 'Wells Fargo', sector: 'Finance', industry: 'Banking' },
  'GS': { name: 'Goldman Sachs', sector: 'Finance', industry: 'Investment Banking' },
  'MS': { name: 'Morgan Stanley', sector: 'Finance', industry: 'Investment Banking' },
  'C': { name: 'Citigroup', sector: 'Finance', industry: 'Banking' },
  'BLK': { name: 'BlackRock', sector: 'Finance', industry: 'Asset Management' },
  'SCHW': { name: 'Charles Schwab', sector: 'Finance', industry: 'Brokerage' },
  'AXP': { name: 'American Express', sector: 'Finance', industry: 'Credit Services' },
  'V': { name: 'Visa Inc.', sector: 'Finance', industry: 'Payment Processing' },
  'MA': { name: 'Mastercard', sector: 'Finance', industry: 'Payment Processing' },
  'PYPL': { name: 'PayPal', sector: 'Finance', industry: 'Payment Processing' },

  // Healthcare
  'JNJ': { name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'UNH': { name: 'UnitedHealth Group', sector: 'Healthcare', industry: 'Health Insurance' },
  'PFE': { name: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'ABBV': { name: 'AbbVie Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'TMO': { name: 'Thermo Fisher Scientific', sector: 'Healthcare', industry: 'Medical Devices' },
  'ABT': { name: 'Abbott Laboratories', sector: 'Healthcare', industry: 'Medical Devices' },
  'MRK': { name: 'Merck & Co.', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'LLY': { name: 'Eli Lilly', sector: 'Healthcare', industry: 'Pharmaceuticals' },
  'AMGN': { name: 'Amgen Inc.', sector: 'Healthcare', industry: 'Biotechnology' },
  'GILD': { name: 'Gilead Sciences', sector: 'Healthcare', industry: 'Biotechnology' },

  // Consumer
  'AMZN': { name: 'Amazon.com Inc.', sector: 'Consumer', industry: 'E-commerce' },
  'TSLA': { name: 'Tesla Inc.', sector: 'Consumer', industry: 'Automotive' },
  'WMT': { name: 'Walmart Inc.', sector: 'Consumer', industry: 'Retail' },
  'HD': { name: 'Home Depot', sector: 'Consumer', industry: 'Retail' },
  'MCD': { name: 'McDonald\'s', sector: 'Consumer', industry: 'Restaurants' },
  'NKE': { name: 'Nike Inc.', sector: 'Consumer', industry: 'Apparel' },
  'SBUX': { name: 'Starbucks', sector: 'Consumer', industry: 'Restaurants' },
  'TGT': { name: 'Target Corporation', sector: 'Consumer', industry: 'Retail' },
  'COST': { name: 'Costco Wholesale', sector: 'Consumer', industry: 'Retail' },
  'PG': { name: 'Procter & Gamble', sector: 'Consumer', industry: 'Consumer Goods' },
  'KO': { name: 'Coca-Cola', sector: 'Consumer', industry: 'Beverages' },
  'PEP': { name: 'PepsiCo', sector: 'Consumer', industry: 'Beverages' },

  // Energy
  'XOM': { name: 'Exxon Mobil', sector: 'Energy', industry: 'Oil & Gas' },
  'CVX': { name: 'Chevron', sector: 'Energy', industry: 'Oil & Gas' },
  'COP': { name: 'ConocoPhillips', sector: 'Energy', industry: 'Oil & Gas' },
  'SLB': { name: 'Schlumberger', sector: 'Energy', industry: 'Oilfield Services' },
  'EOG': { name: 'EOG Resources', sector: 'Energy', industry: 'Oil & Gas' },

  // Industrial
  'BA': { name: 'Boeing', sector: 'Industrial', industry: 'Aerospace' },
  'CAT': { name: 'Caterpillar', sector: 'Industrial', industry: 'Heavy Machinery' },
  'GE': { name: 'General Electric', sector: 'Industrial', industry: 'Conglomerate' },
  'HON': { name: 'Honeywell', sector: 'Industrial', industry: 'Conglomerate' },
  'MMM': { name: '3M Company', sector: 'Industrial', industry: 'Conglomerate' },
  'UPS': { name: 'United Parcel Service', sector: 'Industrial', industry: 'Logistics' },
  'FDX': { name: 'FedEx', sector: 'Industrial', industry: 'Logistics' },

  // Communication
  'DIS': { name: 'Walt Disney', sector: 'Communication', industry: 'Entertainment' },
  'NFLX': { name: 'Netflix Inc.', sector: 'Communication', industry: 'Streaming' },
  'CMCSA': { name: 'Comcast', sector: 'Communication', industry: 'Telecommunications' },
  'T': { name: 'AT&T', sector: 'Communication', industry: 'Telecommunications' },
  'VZ': { name: 'Verizon', sector: 'Communication', industry: 'Telecommunications' },

  // Real Estate
  'AMT': { name: 'American Tower', sector: 'Real Estate', industry: 'REITs' },
  'PLD': { name: 'Prologis', sector: 'Real Estate', industry: 'REITs' },
  'SPG': { name: 'Simon Property Group', sector: 'Real Estate', industry: 'REITs' },

  // Materials
  'LIN': { name: 'Linde plc', sector: 'Materials', industry: 'Chemicals' },
  'APD': { name: 'Air Products', sector: 'Materials', industry: 'Chemicals' },
  'NEM': { name: 'Newmont Corporation', sector: 'Materials', industry: 'Mining' },
};

export interface StockQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: string;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: string;
  pe: number;
  dividendYield: number;
  beta: number;
  week52High: number;
  week52Low: number;
}

export interface NewsArticle {
  title: string;
  url: string;
  summary: string;
  source: string;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  time_published: string;
  ticker_sentiment: Array<{
    ticker: string;
    relevance_score: string;
    ticker_sentiment_score: string;
  }>;
  imageUrl?: string;
  author?: string;
  content?: string;
}

export interface TimeSeriesData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Cache to avoid excessive requests
const cache = new Map<string, { data: any; timestamp: number }>();

// Cache durations for different data types
const CACHE_DURATIONS = {
  STOCK_QUOTE: 15 * 60 * 1000,      // 15 minutes - stock prices change frequently
  COMPANY_INFO: 24 * 60 * 60 * 1000, // 1 day - company info rarely changes
  NEWS: 24 * 60 * 60 * 1000,         // 1 day - news articles
  TIME_SERIES: 60 * 60 * 1000,       // 1 hour - historical data
  SEARCH: 24 * 60 * 60 * 1000,       // 1 day - search results
};

function getCachedData(key: string, cacheDuration: number) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    console.log(`✓ Using cached data for: ${key} (${Math.floor((Date.now() - cached.timestamp) / 60000)}m old)`);
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`✓ Cached data for: ${key}`);
}

// Clear all news caches (memory and localStorage)
export function clearNewsCache() {
  console.log('🗑️ Clearing all news caches...');

  // Clear memory cache for all news keys
  const newsKeys = Array.from(cache.keys()).filter(key => key.startsWith('news_'));
  newsKeys.forEach(key => {
    cache.delete(key);
    console.log(`✓ Cleared memory cache: ${key}`);
  });

  // Clear localStorage for all news keys
  const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('news_'));
  localStorageKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`✓ Cleared localStorage: ${key}`);
  });

  console.log(`✓ Cleared ${newsKeys.length} memory cache entries and ${localStorageKeys.length} localStorage entries`);
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(1)}B`;
  } else if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(1)}M`;
  } else if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(1)}K`;
  }
  return volume.toString();
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const cacheKey = `quote_${symbol}`;
  const cached = getCachedData(cacheKey, CACHE_DURATIONS.STOCK_QUOTE);
  if (cached) return cached;

  // Check circuit breaker before making API call
  checkCircuitBreaker();

  try {
    const url = `${CORS_PROXY}${encodeURIComponent(`${YAHOO_FINANCE_API}/chart/${symbol}?interval=1d&range=1d`)}`;

    const response = await fetch(url);

    if (!response.ok) {
      recordFailure();
      throw new Error(`Yahoo Finance API error ${response.status}`);
    }

    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      recordFailure();
      throw new Error(`Invalid symbol: ${symbol}`);
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];

    const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    const priceChange = currentPrice - prevClose;
    const changePercent = (priceChange / prevClose) * 100;

    const stockQuote: StockQuote = {
      symbol: meta.symbol,
      name: STOCK_SECTORS[symbol]?.name || meta.symbol,
      price: currentPrice,
      change: priceChange,
      changePercent: changePercent,
      high: meta.regularMarketDayHigh || currentPrice,
      low: meta.regularMarketDayLow || currentPrice,
      open: quote.open[quote.open.length - 1] || currentPrice,
      previousClose: prevClose,
      volume: formatVolume(meta.regularMarketVolume || 0),
    };

    setCachedData(cacheKey, stockQuote);
    return stockQuote;
  } catch (error) {
    console.error(`Error fetching stock quote for ${symbol}:`, error);
    recordFailure();

    // Return a placeholder with error info instead of throwing
    return {
      symbol: symbol,
      name: STOCK_SECTORS[symbol]?.name || symbol,
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      volume: 'N/A',
    };
  }
}

export async function getCompanyOverview(symbol: string): Promise<CompanyOverview> {
  const cacheKey = `overview_${symbol}`;
  const cached = getCachedData(cacheKey, CACHE_DURATIONS.COMPANY_INFO);
  if (cached) return cached;

  try {
    const [profileRes, metricsRes] = await Promise.all([
      fetch(`${FMP_BASE_URL}/profile/${symbol}?apikey=${FMP_API_KEY}`),
      fetch(`${FMP_BASE_URL}/key-metrics/${symbol}?limit=1&apikey=${FMP_API_KEY}`)
    ]);

    if (!profileRes.ok) {
      throw new Error(`Profile API error ${profileRes.status}: ${profileRes.statusText}`);
    }

    const profileData = await profileRes.json();
    const metricsData = await metricsRes.json();

    if (!profileData || profileData.length === 0) {
      throw new Error(`No profile data for symbol: ${symbol}`);
    }

    if (profileData.Error) {
      throw new Error(`FMP API Error: ${profileData.Error}`);
    }

    const profile = profileData[0];
    const metrics = metricsData[0] || {};

    const overview: CompanyOverview = {
      symbol: profile.symbol,
      name: profile.companyName,
      description: profile.description || '',
      sector: profile.sector || 'N/A',
      industry: profile.industry || 'N/A',
      marketCap: profile.mktCap ? `$${(profile.mktCap / 1e9).toFixed(2)}B` : 'N/A',
      pe: profile.pe || metrics.peRatio || 0,
      dividendYield: profile.lastDiv || 0,
      beta: profile.beta || 0,
      week52High: profile.range ? parseFloat(profile.range.split('-')[1]) : 0,
      week52Low: profile.range ? parseFloat(profile.range.split('-')[0]) : 0,
    };

    setCachedData(cacheKey, overview);
    return overview;
  } catch (error) {
    console.error('Error fetching company overview:', error);
    throw error;
  }
}

export async function getMarketNews(category?: string, limit: number = 80, offset: number = 0): Promise<NewsArticle[]> {
  const cacheKey = `news_${category || 'all'}`;

  // Check in-memory cache first (1 day duration)
  const memoryCache = getCachedData(cacheKey, CACHE_DURATIONS.NEWS);
  if (memoryCache) {
    return memoryCache.slice(offset, offset + limit);
  }

  // Check localStorage cache (1 day duration)
  const localCache = localStorage.getItem(cacheKey);
  if (localCache) {
    try {
      const { data, timestamp } = JSON.parse(localCache);
      const age = Date.now() - timestamp;
      const NEWS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day

      if (age < NEWS_CACHE_DURATION) {
        console.log(`✓ Using cached news from localStorage (${Math.floor(age / 3600000)}h old)`);
        setCachedData(cacheKey, data); // Also cache in memory
        return data.slice(offset, offset + limit);
      }
    } catch (e) {
      console.error('Error parsing news cache:', e);
    }
  }

  try {
    console.log('📰 Fetching fresh news from FMP API (past 7 days, stock news)...');

    // Calculate date from 7 days ago (extended to get more articles)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTime = sevenDaysAgo.getTime();

    // Fetch stock news from FMP - use stable fmp-articles endpoint
    // FMP max limit is 250 records per request
    const response = await fetch(
      `https://financialmodelingprep.com/stable/fmp-articles?page=0&limit=250&apikey=${FMP_API_KEY}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FMP API error:', response.status, errorText);
      throw new Error(`FMP API returned ${response.status}: ${errorText}`);
    }

    const newsItems = await response.json();

    if (!Array.isArray(newsItems)) {
      console.error('FMP returned non-array response:', newsItems);
      throw new Error('Invalid response format from FMP');
    }

    console.log(`✓ Fetched ${newsItems.length} total news articles from FMP`);

    // Log first article structure to debug date fields
    if (newsItems.length > 0) {
      console.log('Sample article structure:', newsItems[0]);
    }

    // Filter news from past 7 days - check multiple possible date fields
    const recentNews = newsItems.filter((item: any) => {
      const dateField = item.publishedDate || item.date || item.published || item.createdAt;
      if (!dateField) {
        console.log('Article missing date:', item);
        return false;
      }
      const publishedTime = new Date(dateField).getTime();
      return publishedTime >= sevenDaysAgoTime;
    });

    console.log(`✓ Filtered to ${recentNews.length} articles from past 7 days`);

    // Analyze sentiment based on title and text
    const analyzeSentiment = (text: string): 'positive' | 'neutral' | 'negative' => {
      const lowerText = text.toLowerCase();

      // Positive indicators
      const positiveWords = ['surge', 'gain', 'rise', 'bull', 'strong', 'beat', 'exceed', 'growth', 'profit', 'record', 'high', 'upgrade', 'breakthrough', 'success', 'rally', 'soar', 'jump'];
      const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;

      // Negative indicators
      const negativeWords = ['fall', 'drop', 'decline', 'bear', 'weak', 'miss', 'loss', 'concern', 'risk', 'warning', 'cut', 'downgrade', 'crisis', 'plunge', 'crash', 'tumble', 'slump'];
      const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

      if (positiveCount > negativeCount) return 'positive';
      if (negativeCount > positiveCount) return 'negative';
      return 'neutral';
    };

    // Transform articles and use AI to filter/categorize
    const articlesWithTickers: Array<{ article: NewsArticle, tickers: string[] }> = await Promise.all(
      recentNews.map(async (item: any) => {
        const summary = item.text || '';
        const title = item.title || 'Untitled';
        const textForSentiment = `${title} ${summary}`;
        const sentiment = analyzeSentiment(textForSentiment);

        // Use AI to extract stock tickers mentioned in the article
        const mentionedSymbols = await extractStockTickers(title, summary, TRACKED_SYMBOLS);

        // Use AI to categorize the article
        const aiCategory = await categorizeNewsArticle(title, summary);

        const article: NewsArticle = {
          title,
          url: item.url || '#',
          summary: summary || 'Click to read full article',
          source: item.site || 'Financial News',
          category: aiCategory,
          sentiment: sentiment,
          time_published: item.publishedDate || item.date || item.published || item.createdAt || new Date().toISOString(),
          ticker_sentiment: mentionedSymbols.map((ticker: string) => ({
            ticker,
            relevance_score: '0.5',
            ticker_sentiment_score: sentiment === 'positive' ? '0.5' : sentiment === 'negative' ? '-0.5' : '0',
          })),
          imageUrl: item.image,
          author: item.site || 'Financial News',
        };

        return { article, tickers: mentionedSymbols };
      })
    );

    // Filter: only keep articles that mention at least one tracked stock
    const relevantArticles = articlesWithTickers
      .filter(({ tickers }) => tickers.length > 0)
      .map(({ article }) => article);

    console.log(`🤖 AI filtered ${recentNews.length} articles down to ${relevantArticles.length} relevant to tracked stocks`);

    // Sort by newest first
    const sortedArticles = relevantArticles.sort((a, b) => new Date(b.time_published).getTime() - new Date(a.time_published).getTime());

    console.log(`✓ Filtered to ${sortedArticles.length} articles relevant to tracked stocks`);

    // Cache in both memory and localStorage
    setCachedData(cacheKey, sortedArticles);
    localStorage.setItem(cacheKey, JSON.stringify({
      data: sortedArticles,
      timestamp: Date.now()
    }));

    console.log(`✓ Cached ${sortedArticles.length} news articles (showing top ${Math.min(limit, sortedArticles.length)})`);
    return sortedArticles.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error fetching market news from FMP:', error);

    // Return cached data even if expired, as fallback
    if (localCache) {
      try {
        const { data } = JSON.parse(localCache);
        console.log('Using expired cache as fallback');
        return data.slice(offset, offset + limit);
      } catch (e) {
        // Ignore parse errors
      }
    }

    return [];
  }
}

export async function getTimeSeriesDaily(symbol: string): Promise<TimeSeriesData[]> {
  const cacheKey = `timeseries_${symbol}`;
  const cached = getCachedData(cacheKey, CACHE_DURATIONS.TIME_SERIES);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${FMP_BASE_URL}/historical-price-full/${symbol}?apikey=${FMP_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`FMP API error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.Error) {
      throw new Error(`FMP API Error: ${data.Error}`);
    }

    if (!data.historical || data.historical.length === 0) {
      throw new Error('No time series data available');
    }

    // Get last 30 days
    const timeSeries: TimeSeriesData[] = data.historical
      .slice(0, 30)
      .reverse()
      .map((item: any) => ({
        timestamp: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

    setCachedData(cacheKey, timeSeries);
    return timeSeries;
  } catch (error) {
    console.error('Error fetching time series data:', error);
    throw error;
  }
}



// Search for stocks by keyword
export async function searchSymbols(keywords: string): Promise<Array<{ symbol: string; name: string }>> {
  const cacheKey = `search_${keywords}`;
  const cached = getCachedData(cacheKey, CACHE_DURATIONS.SEARCH);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${FMP_BASE_URL}/search?query=${keywords}&limit=10&apikey=${FMP_API_KEY}`
    );
    const data = await response.json();

    const results = data.map((item: any) => ({
      symbol: item.symbol,
      name: item.name,
    }));

    setCachedData(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Error searching symbols:', error);
    throw error;
  }
}

// Get stock sector information from hardcoded mapping
export function getStockSectorInfo(symbol: string): { name: string; sector: string; industry: string } {
  return STOCK_SECTORS[symbol] || {
    name: symbol,
    sector: 'Other',
    industry: 'Unknown'
  };
}
