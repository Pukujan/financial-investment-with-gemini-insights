export interface StockQuote {
  symbol: string;
  name?: string;
  sector?: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: string;
  pe?: number;
  marketCap?: string;
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

export interface EnrichedStockInput {
  symbol: string;
  name: string;
  price: number;
  change: number;
  pe: number;
  marketCap: string;
}

export interface AIRecommendation {
  symbol: string;
  company: string;
  action: 'Buy' | 'Hold' | 'Sell';
  confidence: number;
  targetPrice: string;
  reason: string;
}

export interface AITrend {
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  affectedStocks: string[];
}

export interface AIRisk {
  title: string;
  description: string;
  severity: 'High' | 'Medium' | 'Low';
  recommendation: string;
}

export interface AIPortfolio {
  diversificationScore: number;
  diversificationAdvice: string;
  growthPotential: string;
  growthAdvice: string;
}

export interface AIStats {
  accuracyRate: string;
  stocksAnalyzed: number;
  successRate: string;
  activeSignals: number;
}

export interface AIInsights {
  recommendations: AIRecommendation[];
  trends: AITrend[];
  risks: AIRisk[];
  portfolio: AIPortfolio;
  stats: AIStats;
}

export interface StockPrediction {
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  confidence: number;
  reasoning: string;
  factors: string[];
  timestamp: number;
}

export interface Holding {
  symbol: string;
  name: string;
  shares: number;
  currentPrice: number;
  totalValue: number;
}

export interface PortfolioDocument {
  holdings: Holding[];
  lastUpdated: string;
}

/** `live` = Yahoo Finance API. `mock` = static catalog. `agent` = LLM scrape agents (OpenRouter). */
export type MarketDataMode = 'live' | 'mock' | 'agent';

export type MarketLiveProvider = 'yahoo';
export type MarketAgentProvider = 'openrouter-agent';

export type MarketProvider = MarketLiveProvider | MarketAgentProvider | 'mock-catalog';

export type QuoteDataMode = 'live' | 'mock';

export interface MarketDataSettings {
  dataMode: MarketDataMode;
  /** Quote/news source when dataMode is agent (Live or Mock) */
  quoteDataMode: QuoteDataMode;
  /** Active data provider for the current mode */
  provider: MarketProvider;
  /** Whether the live quote provider responded successfully (only meaningful in live mode) */
  liveReachable: boolean | null;
  liveProbeError?: string;
  stockFetchLimit: number;
  /** Max symbols shown in agent mode and per chart scrape job */
  agentScrapeSymbolLimit: number;
  /** Hours before live data is refetched (default 24) */
  cacheTtlHours: number;
  /** ISO time of last successful live quote cache, if any */
  quotesCachedAt?: string;
  /** ISO time of last successful live news cache, if any */
  newsCachedAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  /** Set on Railway from RAILWAY_GIT_COMMIT_SHA — verify deploy matches GitHub main. */
  gitCommitSha?: string;
  checks: {
    firebase: 'ok' | 'unconfigured' | 'error';
    openrouter: 'ok' | 'unconfigured';
    openrouterPrimaryModel: string;
    openrouterFallbackModel: string;
    marketDataMode: MarketDataMode;
    marketLiveProvider: MarketProvider;
    marketLiveReachable: boolean | null;
  };
  env?: {
    missing: string[];
    warnings: string[];
  };
}
