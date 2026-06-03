import type { AiCostTier } from './aiEstimate.js';
import type { TokenUsageEstimate } from './agentScrape.js';
import type {
  DemoMarketNewsItem,
  SevenDayPrediction,
  StockTrendAnalysis,
} from './stocksAgentV2.js';

/** Symbols per Agent v2 A/B matrix run. */
export const PROMPT_AB_V2_SYMBOL_LIMIT = 5;

export const PROMPT_AB_V2_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'] as const;

/** Five hybrid prompt variants — same inputs, different deterministic formula + temporal chain. */
export const PROMPT_AB_V2_PROMPT_IDS = [
  'alpha-6040',
  'beta-5050',
  'gamma-7030',
  'delta-temporal',
  'epsilon-volatility',
] as const;

export type PromptAbV2PromptId = (typeof PROMPT_AB_V2_PROMPT_IDS)[number];

export const PROMPT_AB_V2_PROMPT_LABELS: Record<PromptAbV2PromptId, string> = {
  'alpha-6040': 'Alpha 60/40 (trend-heavy baseline)',
  'beta-5050': 'Beta 50/50 (balanced blend)',
  'gamma-7030': 'Gamma 70/30 (momentum-first)',
  'delta-temporal': 'Delta temporal (recency decay chain)',
  'epsilon-volatility': 'Epsilon volatility-adjusted',
};

export interface PromptAbV2DeterministicAnchor {
  trendWeight: number;
  newsWeight: number;
  trendScore: number;
  newsScore: number;
  combinedScore: number;
  direction: SevenDayPrediction['direction'];
  confidenceScore: number;
  formulaLabel: string;
  temporalChain: string[];
}

export interface PromptAbV2CellResult {
  symbol: string;
  promptId: PromptAbV2PromptId;
  promptLabel: string;
  tier: AiCostTier;
  modelId: string;
  modelName: string;
  promptVersion: string;
  systemPromptExcerpt: string;
  userPromptExcerpt: string;
  deterministic: PromptAbV2DeterministicAnchor;
  prediction: Pick<
    SevenDayPrediction,
    | 'direction'
    | 'confidenceScore'
    | 'confidenceReason'
    | 'reasoningSteps'
    | 'scenarioPath'
    | 'expectedScenario'
    | 'keyReasons'
    | 'risks'
    | 'processingSummary'
  >;
  trend: StockTrendAnalysis;
  newsItemCount: number;
  newsSample: DemoMarketNewsItem[];
  promptTokens: number;
  completionTokens: number;
  tokensUsed: number;
  costUsd: number;
  llmUsed: boolean;
  error?: string;
}

export interface PromptAbV2PromptArmSummary {
  promptId: PromptAbV2PromptId;
  promptLabel: string;
  promptVersion: string;
  formulaLabel: string;
  avgConfidence: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  avgEndPriceDeltaPct: number;
  totalTokens: number;
  totalCostUsd: number;
  cells: PromptAbV2CellResult[];
}

export interface PromptAbV2TierSummary {
  tier: AiCostTier;
  modelId: string;
  modelName: string;
  avgConfidence: number;
  totalTokens: number;
  totalCostUsd: number;
  cells: PromptAbV2CellResult[];
}

export interface PromptAbV2RunDelta {
  previousRunId: string | null;
  previousCompletedAt: string | null;
  confidenceDeltaByPrompt: Record<PromptAbV2PromptId, number | null>;
  directionChangesBySymbol: Array<{
    symbol: string;
    promptId: PromptAbV2PromptId;
    tier: AiCostTier;
    previousDirection: SevenDayPrediction['direction'] | null;
    currentDirection: SevenDayPrediction['direction'];
  }>;
  costDeltaUsd: number | null;
}

export interface PromptAbV2Experiment {
  id: string;
  completedAt: string;
  symbols: string[];
  promptIds: PromptAbV2PromptId[];
  tiers: AiCostTier[];
  totalCells: number;
  completedCells: number;
  arms: PromptAbV2PromptArmSummary[];
  byTier: PromptAbV2TierSummary[];
  matrix: PromptAbV2CellResult[];
  headline: string;
  costEval?: {
    estimatedCostUsd: number;
    actualCostUsd: number;
    tokens: TokenUsageEstimate;
  };
  runDelta?: PromptAbV2RunDelta;
}

export interface PromptAbV2History {
  records: PromptAbV2Experiment[];
  lastRecord: PromptAbV2Experiment | null;
}

export interface PromptAbV2Summary {
  experimentId: string;
  completedAt: string;
  symbolsTested: number;
  promptCount: number;
  tierCount: number;
  totalCells: number;
  actualCostUsd: number;
  avgConfidence: number;
  headline: string;
}

export type PromptAbV2JobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type PromptAbV2StepStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PromptAbV2QueueItem {
  id: string;
  symbol: string;
  promptId: PromptAbV2PromptId;
  tier: AiCostTier;
  status: PromptAbV2StepStatus;
  detail?: string;
}

export interface PromptAbV2JobStep {
  id: string;
  label: string;
  status: PromptAbV2StepStatus;
  detail?: string;
}

export interface PromptAbV2Job {
  id: string;
  status: PromptAbV2JobStatus;
  symbols: string[];
  promptIds: PromptAbV2PromptId[];
  tiers: AiCostTier[];
  phaseLabel: string;
  progress: { completed: number; total: number };
  queue: PromptAbV2QueueItem[];
  steps: PromptAbV2JobStep[];
  startedAt: string;
  updatedAt: string;
  summary?: PromptAbV2Summary;
  experiment?: PromptAbV2Experiment;
  error?: string;
}

export interface PromptAbV2CostEstimate {
  symbolCount: number;
  promptCount: number;
  tierCount: number;
  totalCells: number;
  estimatedTokens: TokenUsageEstimate;
  estimatedCostUsd: number;
  pricingFetchedAt: string;
}
