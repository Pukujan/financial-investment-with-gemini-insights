import type { AgentScrapeJob } from './agentJob.js';
import type { AgentScrapeUsage, TokenUsageEstimate } from './agentScrape.js';
import type { AiCostTier } from './aiEstimate.js';

/** How close actual token usage was to the pre-scrape estimate */
export type EstimateAccuracyRating =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'poor'
  | 'cached'
  | 'unknown';

export interface AgentEstimateSnapshot {
  estimatedTokens: TokenUsageEstimate;
  estimatedCostUsd: number;
  symbolCount: number;
  quotesFullyCached: boolean;
  newsCached: boolean;
  pricingFetchedAt: string;
}

/** Golden actuals vs estimate from a completed agent scrape job */
export interface AgentEstimateEvalRecord {
  jobId: string;
  tier: AiCostTier;
  modelId?: string;
  completedAt: string;
  fromCache: boolean;
  estimate: AgentEstimateSnapshot;
  actual: {
    tokens: TokenUsageEstimate;
    costUsd: number;
  };
  /** actual.total - estimate.total */
  tokenDelta: number;
  /** Percent vs estimate; null when estimate total is 0 */
  tokenDeltaPercent: number | null;
  costDeltaUsd: number;
  costDeltaPercent: number | null;
  accuracy: EstimateAccuracyRating;
}

export interface AgentEstimateEvalSummary {
  recordCount: number;
  avgTokenDeltaPercent: number | null;
  avgCostDeltaPercent: number | null;
  accuracyCounts: Record<EstimateAccuracyRating, number>;
  lastRecord: AgentEstimateEvalRecord | null;
}

export interface AgentEstimateEvalHistory {
  records: AgentEstimateEvalRecord[];
  summary: AgentEstimateEvalSummary;
}

const EMPTY_ACCURACY_COUNTS: Record<EstimateAccuracyRating, number> = {
  excellent: 0,
  good: 0,
  fair: 0,
  poor: 0,
  cached: 0,
  unknown: 0,
};

function ratingFromDeltaPercent(deltaPercent: number | null): EstimateAccuracyRating {
  if (deltaPercent === null) return 'unknown';
  const abs = Math.abs(deltaPercent);
  if (abs <= 10) return 'excellent';
  if (abs <= 25) return 'good';
  if (abs <= 50) return 'fair';
  return 'poor';
}

/** True when no OpenRouter tokens were consumed (fully cached load). */
export function isZeroTokenUsage(usage: Pick<AgentScrapeUsage, 'tokensUsed'>): boolean {
  return usage.tokensUsed === 0;
}

/** Build eval record from a completed job (client or server). */
export function buildEstimateEvalFromJob(job: AgentScrapeJob): AgentEstimateEvalRecord | null {
  const snapshot = job.estimateSnapshot;
  const usage = job.usage;
  if (!snapshot || !usage || !job.completedAt) return null;

  const actualTokens = {
    prompt: usage.promptTokens,
    completion: usage.completionTokens,
    total: usage.tokensUsed,
  };
  const estTotal = snapshot.estimatedTokens.total;
  const tokenDelta = actualTokens.total - estTotal;
  const tokenDeltaPercent = estTotal > 0 ? (tokenDelta / estTotal) * 100 : null;

  const actualCostUsd = usage.actualCostUsd ?? 0;
  const costDeltaUsd = actualCostUsd - snapshot.estimatedCostUsd;
  const costDeltaPercent =
    snapshot.estimatedCostUsd > 0
      ? (costDeltaUsd / snapshot.estimatedCostUsd) * 100
      : null;

  const fullyCached = isZeroTokenUsage(usage);
  let accuracy: EstimateAccuracyRating;
  if (fullyCached) {
    accuracy = 'cached';
  } else {
    accuracy = ratingFromDeltaPercent(tokenDeltaPercent);
  }

  return {
    jobId: job.id,
    tier: job.tier,
    modelId: usage.modelId,
    completedAt: job.completedAt,
    fromCache: fullyCached,
    estimate: snapshot,
    actual: {
      tokens: actualTokens,
      costUsd: actualCostUsd,
    },
    tokenDelta,
    tokenDeltaPercent,
    costDeltaUsd,
    costDeltaPercent,
    accuracy,
  };
}

export function summarizeEstimateEvals(
  records: AgentEstimateEvalRecord[]
): AgentEstimateEvalSummary {
  const tokenPercents = records
    .map(r => r.tokenDeltaPercent)
    .filter((p): p is number => p != null);
  const costPercents = records
    .map(r => r.costDeltaPercent)
    .filter((p): p is number => p != null);

  const accuracyCounts = { ...EMPTY_ACCURACY_COUNTS };
  for (const r of records) {
    accuracyCounts[r.accuracy] += 1;
  }

  const avg = (vals: number[]) =>
    vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  return {
    recordCount: records.length,
    avgTokenDeltaPercent: avg(tokenPercents),
    avgCostDeltaPercent: avg(costPercents),
    accuracyCounts,
    lastRecord: records[0] ?? null,
  };
}
