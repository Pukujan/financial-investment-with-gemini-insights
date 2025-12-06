// Yahoo Finance API with CORS proxy - No API key required
// Using cors-anywhere proxy for development

const CORS_PROXY = 'https://corsproxy.io/?';
const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance';

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
const CACHE_DURATION = 60000; // 1 minute

function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
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
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CORS_PROXY}${encodeURIComponent(`${YAHOO_FINANCE_API}/chart/${symbol}?interval=1d&range=1d`)}`
    );
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
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
    console.error('Error fetching stock quote:', error);
    throw error;
  }
}

export async function getCompanyOverview(symbol: string): Promise<CompanyOverview> {
  const cacheKey = `overview_${symbol}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CORS_PROXY}${encodeURIComponent(`${YAHOO_FINANCE_API}/quoteSummary/${symbol}?modules=summaryDetail,price,defaultKeyStatistics,assetProfile`)}`
    );
    const data = await response.json();

    if (!data.quoteSummary || !data.quoteSummary.result) {
      throw new Error(`Invalid symbol: ${symbol}`);
    }

    const result = data.quoteSummary.result[0];
    const profile = result.assetProfile || {};
    const stats = result.defaultKeyStatistics || {};
    const summary = result.summaryDetail || {};

    const overview: CompanyOverview = {
      symbol,
      name: profile.longName || symbol,
      description: profile.longBusinessSummary || '',
      sector: profile.sector || 'N/A',
      industry: profile.industry || 'N/A',
      marketCap: result.price?.marketCap?.fmt || 'N/A',
      pe: stats.trailingPE?.raw || 0,
      dividendYield: summary.dividendYield?.raw || 0,
      beta: stats.beta?.raw || 0,
      week52High: summary.fiftyTwoWeekHigh?.raw || 0,
      week52Low: summary.fiftyTwoWeekLow?.raw || 0,
    };

    setCachedData(cacheKey, overview);
    return overview;
  } catch (error) {
    console.error('Error fetching company overview:', error);
    throw error;
  }
}

export async function getMarketNews(tickers?: string[]): Promise<NewsArticle[]> {
  const cacheKey = `news_${tickers?.join(',') || 'general'}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    // Yahoo Finance doesn't have a free news API endpoint
    // Using mock data instead - you can integrate NewsAPI.org or similar
    const { mockNews } = await import('../data/mockData');

    const articles: NewsArticle[] = mockNews.map(n => ({
      title: n.title,
      url: '#',
      summary: n.summary,
      source: n.author || 'Financial Times',
      category: n.category,
      sentiment: n.sentiment,
      time_published: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      ticker_sentiment: n.relatedStocks.map(ticker => ({
        ticker,
        relevance_score: '0.8',
        ticker_sentiment_score: n.sentiment === 'positive' ? '0.5' : n.sentiment === 'negative' ? '-0.5' : '0',
      })),
      imageUrl: n.imageUrl,
      author: n.author,
      content: n.content,
    }));

    setCachedData(cacheKey, articles);
    return articles;
  } catch (error) {
    console.error('Error fetching market news:', error);
    throw error;
  }
}

export async function getTimeSeriesDaily(symbol: string): Promise<TimeSeriesData[]> {
  const cacheKey = `timeseries_${symbol}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CORS_PROXY}${encodeURIComponent(`${YAHOO_FINANCE_API}/chart/${symbol}?interval=1d&range=1mo`)}`
    );
    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('No time series data available');
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    const timeSeries: TimeSeriesData[] = timestamps.map((ts: number, i: number) => ({
      timestamp: new Date(ts * 1000).toISOString().split('T')[0],
      open: quote.open[i] || 0,
      high: quote.high[i] || 0,
      low: quote.low[i] || 0,
      close: quote.close[i] || 0,
      volume: quote.volume[i] || 0,
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
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${CORS_PROXY}${encodeURIComponent(`${YAHOO_FINANCE_API}/search?q=${keywords}&quotesCount=10&newsCount=0`)}`
    );
    const data = await response.json();

    const results = data.quotes?.slice(0, 10).map((quote: any) => ({
      symbol: quote.symbol,
      name: quote.longname || quote.shortname || quote.symbol,
    })) || [];

    setCachedData(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Error searching symbols:', error);
    throw error;
  }
}
