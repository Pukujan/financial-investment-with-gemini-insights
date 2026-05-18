export interface TokenUsageEstimate {
  prompt: number;
  completion: number;
  total: number;
}

export interface AgentScrapeBatchEstimate {
  symbols: string[];
  cached: boolean;
}

import type { AiCostTier, AiOperationEstimate } from './aiEstimate.js';

/** Agent scrape estimate with tier comparison and USD pricing */
export type AgentScrapeEstimate = AiOperationEstimate;

export interface AgentScrapeUsage {
  fromCache: boolean;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  liveBatches: number;
  cachedBatches: number;
  newsFromCache: boolean;
  newsTokensUsed: number;
  tier?: AiCostTier;
  modelId?: string;
  actualCostUsd?: number;
  chartMode?: 'synthetic' | 'llm';
  chartsScraped?: boolean;
  chartTokensUsed?: number;
}
