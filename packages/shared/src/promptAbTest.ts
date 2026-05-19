import type { AiCostTier } from './aiEstimate.js';
import type { TokenUsageEstimate } from './agentScrape.js';
import type { EstimateAccuracyRating } from './estimateEval.js';
import type { ChartPriceConvention } from './tradingDays.js';
import type { PromptEvalComparisonMode, PromptEvalGoldenSymbol, PromptEvalTierSymbol } from './promptEval.js';

/** Production prompt arm for A/B tab (not v2). */
export const PROMPT_AB_VERSION_A_DEFAULT = '2026-05-19';
/** Experimental v2 — A/B tab only; main dashboard keeps PROMPT_LATEST. */
export const PROMPT_AB_VERSION_B_DEFAULT = '2026-05-20';

export interface PromptAbCostEstimateSnapshot {
  estimatedTokens: TokenUsageEstimate;
  estimatedCostUsd: number;
  symbolCount: number;
  armCount: 2;
  ragEnabled: boolean;
  pricingFetchedAt: string;
}

export interface PromptAbCostEval {
  estimate: PromptAbCostEstimateSnapshot;
  actual: {
    tokens: TokenUsageEstimate;
    costUsd: number;
  };
  tokenDelta: number;
  tokenDeltaPercent: number | null;
  costDeltaUsd: number;
  costDeltaPercent: number | null;
  accuracy: EstimateAccuracyRating;
}

/** Accuracy (quote deviation %) per unit spend — lower is more efficient. */
export interface PromptAbArmEfficiency {
  accuracyPer1kTokens: number;
  accuracyPerCentUsd: number;
  costUsd: number;
  tokensUsed: number;
}

export interface PromptAbEfficiencyCompare {
  armA: PromptAbArmEfficiency;
  armB: PromptAbArmEfficiency;
  /** B vs A on accuracy-per-1k-tokens; positive = B more efficient */
  accuracyPerTokenGainPct: number | null;
  /** B vs A on total cost; negative = B cheaper */
  costDeltaUsd: number;
  moreEfficientArm: 'A' | 'B' | 'tie';
}

export interface PromptAbEngineeringInsight {
  summary: string;
  recommendations: string[];
  promptTweaks: string[];
  generatedAt: string;
  modelId: string;
  tokensUsed?: number;
}

export interface PromptAbTestArmResult {
  arm: 'A' | 'B';
  promptVersion: string;
  resolvedVersion: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  tokensUsed: number;
  costUsd: number;
  avgAbsQuoteDeviationPct: number;
  avgAbsDailyDeviationPct: number | null;
  symbols: PromptEvalTierSymbol[];
  reasoning?: string;
  efficiency: PromptAbArmEfficiency;
}

export interface PromptAbTestWinner {
  overall: 'A' | 'B' | 'tie';
  byQuote: 'A' | 'B' | 'tie';
  byDaily: 'A' | 'B' | 'tie';
}

/** Side-by-side quote-scrape A/B vs Live-mode cached ground truth. */
export interface PromptAbTestExperiment {
  id: string;
  completedAt: string;
  tier: AiCostTier;
  versionA: string;
  versionB: string;
  resolvedVersionA: string;
  resolvedVersionB: string;
  ragEnabled: boolean;
  evalWindowDays: number;
  comparisonMode: PromptEvalComparisonMode;
  priceConvention: ChartPriceConvention;
  goldenReference: 'yahoo' | 'cache';
  groundTruthSource: string;
  symbols: string[];
  golden: PromptEvalGoldenSymbol[];
  armA: PromptAbTestArmResult;
  armB: PromptAbTestArmResult;
  winner: PromptAbTestWinner;
  headline: string;
  costEval?: PromptAbCostEval;
  efficiency?: PromptAbEfficiencyCompare;
  engineeringInsight?: PromptAbEngineeringInsight;
}

export interface PromptAbTestHistory {
  records: PromptAbTestExperiment[];
  lastRecord: PromptAbTestExperiment | null;
}

export interface PromptAbTestSummary {
  experimentId: string;
  completedAt: string;
  versionA: string;
  versionB: string;
  tier: AiCostTier;
  symbolsTested: number;
  groundTruthSource: string;
  winner: PromptAbTestWinner;
  armAQuoteDevPct: number;
  armBQuoteDevPct: number;
  armADailyDevPct: number | null;
  armBDailyDevPct: number | null;
  estimatedCostUsd: number;
  actualCostUsd: number;
  costDeltaPercent: number | null;
  moreEfficientArm: 'A' | 'B' | 'tie';
  headline: string;
}

export type PromptAbTestJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type PromptAbTestStepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PromptAbTestJobStep {
  id: string;
  label: string;
  status: PromptAbTestStepStatus;
  detail?: string;
}

export interface PromptAbTestJob {
  id: string;
  status: PromptAbTestJobStatus;
  versionA: string;
  versionB: string;
  tier: AiCostTier;
  ragEnabled: boolean;
  symbolLimit?: number;
  phaseLabel: string;
  progress: { completed: number; total: number };
  steps: PromptAbTestJobStep[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  estimateSnapshot?: PromptAbCostEstimateSnapshot;
  experiment?: PromptAbTestExperiment;
  summary?: PromptAbTestSummary;
}

function ratingFromDeltaPercent(deltaPercent: number | null): EstimateAccuracyRating {
  if (deltaPercent === null) return 'unknown';
  const abs = Math.abs(deltaPercent);
  if (abs <= 10) return 'excellent';
  if (abs <= 25) return 'good';
  if (abs <= 50) return 'fair';
  return 'poor';
}

export function buildArmEfficiency(
  avgAbsQuoteDeviationPct: number,
  tokensUsed: number,
  costUsd: number
): PromptAbArmEfficiency {
  const per1k = tokensUsed > 0 ? avgAbsQuoteDeviationPct / (tokensUsed / 1000) : 0;
  const perCent = costUsd > 0 ? avgAbsQuoteDeviationPct / (costUsd * 100) : 0;
  return {
    accuracyPer1kTokens: per1k,
    accuracyPerCentUsd: perCent,
    costUsd,
    tokensUsed,
  };
}

export function buildPromptAbCostEval(
  estimate: PromptAbCostEstimateSnapshot,
  actualPrompt: number,
  actualCompletion: number,
  actualCostUsd: number
): PromptAbCostEval {
  const actualTotal = actualPrompt + actualCompletion;
  const estTotal = estimate.estimatedTokens.total;
  const tokenDelta = actualTotal - estTotal;
  const tokenDeltaPercent = estTotal > 0 ? (tokenDelta / estTotal) * 100 : null;
  const costDeltaUsd = actualCostUsd - estimate.estimatedCostUsd;
  const costDeltaPercent =
    estimate.estimatedCostUsd > 0 ? (costDeltaUsd / estimate.estimatedCostUsd) * 100 : null;

  return {
    estimate,
    actual: {
      tokens: { prompt: actualPrompt, completion: actualCompletion, total: actualTotal },
      costUsd: actualCostUsd,
    },
    tokenDelta,
    tokenDeltaPercent,
    costDeltaUsd,
    costDeltaPercent,
    accuracy: ratingFromDeltaPercent(tokenDeltaPercent),
  };
}

export function buildPromptAbEfficiencyCompare(
  armA: PromptAbTestArmResult,
  armB: PromptAbTestArmResult
): PromptAbEfficiencyCompare {
  const effA = armA.efficiency.accuracyPer1kTokens;
  const effB = armB.efficiency.accuracyPer1kTokens;
  let moreEfficientArm: PromptAbEfficiencyCompare['moreEfficientArm'] = 'tie';
  if (Math.abs(effA - effB) > 0.001) {
    moreEfficientArm = effB < effA ? 'B' : 'A';
  }
  const accuracyPerTokenGainPct =
    effA > 0 ? ((effA - effB) / effA) * 100 : null;

  return {
    armA: armA.efficiency,
    armB: armB.efficiency,
    accuracyPerTokenGainPct,
    costDeltaUsd: armB.costUsd - armA.costUsd,
    moreEfficientArm,
  };
}
