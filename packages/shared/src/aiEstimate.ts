import type { AgentScrapeBatchEstimate, TokenUsageEstimate } from './agentScrape.js';

/** Paid tiers — all cheap; “cheap” is the best of the three, not expensive. */
export type AiCostTier = 'cheapest' | 'cheaper' | 'cheap';

export const AI_COST_TIER_LABELS: Record<AiCostTier, string> = {
  cheapest: 'Cheapest',
  cheaper: 'Cheaper',
  cheap: 'Cheap',
};

export const AI_COST_TIERS: AiCostTier[] = ['cheapest', 'cheaper', 'cheap'];

export interface ModelTierInfo {
  tier: AiCostTier;
  label: string;
  modelId: string;
  modelName: string;
  /** USD per 1M prompt tokens */
  promptPerMillionUsd: number;
  /** USD per 1M completion tokens */
  completionPerMillionUsd: number;
  /** 1 = lowest tier, 3 = best quality among the three */
  strengthRank: number;
}

export interface TierEstimate {
  tier: AiCostTier;
  label: string;
  model: ModelTierInfo;
  estimatedTokens: TokenUsageEstimate;
  estimatedCostUsd: number;
  liveRequestCount: number;
  cachedRequestCount: number;
}

/** Cache readiness before starting an agent scrape */
export type AgentCacheState =
  | 'no_data'
  | 'ready_fresh'
  | 'ready_aging'
  | 'partial'
  | 'needs_scrape';

export interface AgentCacheInfo {
  state: AgentCacheState;
  label: string;
  detail: string;
  cachedAt: string | null;
  cacheAgeHours: number | null;
  cacheTtlHours: number;
  cacheExpiresAt: string | null;
  quotesFullyCached: boolean;
  newsCached: boolean;
  cachedBatchCount: number;
  liveBatchCount: number;
}

export interface AiOperationEstimate {
  operation: 'agent-scrape';
  symbolCount: number;
  batchCount: number;
  batchSize: number;
  quotesFullyCached: boolean;
  newsCached: boolean;
  batches: AgentScrapeBatchEstimate[];
  cache: AgentCacheInfo;
  tiers: TierEstimate[];
  pricingFetchedAt: string;
}
