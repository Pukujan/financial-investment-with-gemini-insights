/** Registry key for each LLM surface in InvestAI. */
export type PromptId =
  | 'quote-scrape'
  | 'chart-scrape'
  | 'news-scrape'
  | 'ai-insights'
  | 'ai-prediction';

/** Semantic version string (YYYY-MM-DD) stored on eval runs and jobs. */
export type PromptVersion = string;

export interface ResolvedPrompt {
  id: PromptId;
  version: PromptVersion;
  system: string;
  user: string;
}

export interface QuoteScrapeContext {
  symbols: string[];
  goldenHint?: string;
  ragContext?: string;
}

export interface ChartScrapeContext {
  symbol: string;
  tradingDayKeys: string[];
  anchorPrice?: number;
  /** Yahoo / Live-cache last EOD close — authoritative for v3 alignment. */
  goldenHint?: string;
  ragContext?: string;
}

export interface NewsScrapeContext {
  topics: string[];
  limit: number;
}

export interface AiInsightsContext {
  stockLines: string;
  newsBlock: string;
}

export interface AiPredictionContext {
  symbol: string;
  historicalLines: string;
  currentPrice: number;
}

export interface PromptSuiteVersions {
  quoteScrape: PromptVersion;
  chartScrape: PromptVersion;
  newsScrape: PromptVersion;
  aiInsights: PromptVersion;
  aiPrediction: PromptVersion;
}

export interface PromptCatalogEntry {
  id: PromptId;
  version: PromptVersion;
  label: string;
  summary: string;
  changelog: string;
  supportsRag: boolean;
  supportsGoldenHint: boolean;
}
