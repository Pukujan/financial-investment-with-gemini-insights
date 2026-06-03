/** Agent v2 — Yahoo 30-day trend + synthetic demo news + 7-day scenario prediction. */

export const AGENT_V2_PROMPT_VERSION = 'v2' as const;

export type StockOHLCVPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type StockTrendAnalysis = {
  symbol: string;
  startClose: number;
  latestClose: number;
  priceChangePercent: number;
  averageVolume: number;
  recentAverageVolume: number;
  volumeTrend: 'Rising' | 'Falling' | 'Flat';
  volatility: 'Low' | 'Medium' | 'High';
  momentum: 'Bullish' | 'Neutral' | 'Bearish';
  trendSummary: string;
  sessionCount: number;
};

export type DemoMarketNewsItem = {
  id: string;
  symbol: string;
  companyName: string;
  headline: string;
  source: string;
  publishedAt: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  impact: 'low' | 'medium' | 'high';
  catalystTags: string[];
  derivedFrom: {
    dataSource: 'Yahoo 30-day OHLCV';
    priceChangePercent: number;
    volumeTrend: 'Rising' | 'Falling' | 'Flat';
    volatility: 'Low' | 'Medium' | 'High';
    momentum: 'Bullish' | 'Neutral' | 'Bearish';
  };
  isSynthetic: true;
};

export type CachedDemoMarketNews = {
  symbol: string;
  companyName: string;
  promptVersion: typeof AGENT_V2_PROMPT_VERSION;
  generatedAt: string;
  expiresAt: string;
  trend: StockTrendAnalysis;
  items: DemoMarketNewsItem[];
};

export type SevenDayPrediction = {
  symbol: string;
  companyName: string;
  promptVersion: typeof AGENT_V2_PROMPT_VERSION;
  dataMode: 'Yahoo 30-Day Trend + Synthetic Demo News';
  direction: 'Bullish' | 'Neutral' | 'Bearish';
  confidenceScore: number;
  confidenceReason: string;
  processingSummary: string;
  reasoningSteps: string[];
  trendInputsUsed: {
    priceChangePercent: number;
    volumeTrend: StockTrendAnalysis['volumeTrend'];
    volatility: StockTrendAnalysis['volatility'];
    momentum: StockTrendAnalysis['momentum'];
    startClose: number;
    latestClose: number;
    sessionCount: number;
  };
  newsEvaluation: {
    itemCount: number;
    weightedSentimentScore: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    highImpactCount: number;
    alignmentWithTrend: 'aligned' | 'mixed' | 'conflicting';
  };
  expectedScenario: {
    baseCase: string;
    bullCase: string;
    bearCase: string;
  };
  keyReasons: string[];
  risks: string[];
  sourceTrend: StockTrendAnalysis;
  sourceNews: DemoMarketNewsItem[];
  scenarioPath: Array<{ date: string; price: number; isScenario: true }>;
  generatedAt: string;
  disclaimer: string;
};

export type CachedSevenDayPrediction = {
  symbol: string;
  promptVersion: typeof AGENT_V2_PROMPT_VERSION;
  generatedAt: string;
  expiresAt: string;
  newsGeneratedAt: string;
  prediction: SevenDayPrediction;
};

export const AGENT_V2_COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  ADBE: 'Adobe Inc.',
  AMD: 'Advanced Micro Devices',
  CRM: 'Salesforce Inc.',
  GOOGL: 'Alphabet Inc.',
  INTC: 'Intel Corporation',
  META: 'Meta Platforms Inc.',
  MSFT: 'Microsoft Corporation',
  NVDA: 'NVIDIA Corporation',
  ORCL: 'Oracle Corporation',
};

export const AGENT_V2_SYMBOLS = Object.keys(AGENT_V2_COMPANY_NAMES);
