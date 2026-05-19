import type { AiCostTier } from './aiEstimate.js';
import type { PromptSuiteVersions } from './promptSuite.js';
import type { ChartDayComparison, ChartPriceConvention } from './tradingDays.js';

/** Trading-day EOD window for golden comparison (not a single 1-day spot check). */
export const PROMPT_EVAL_WINDOW_DAYS = 30;

export type PromptEvalComparisonMode = '30d-eod';

export interface PromptEvalGoldenSymbol {
  symbol: string;
  yahooClose: number;
  yahooPreviousClose: number;
}

export interface PromptEvalTierSymbol {
  symbol: string;
  agentPrice: number;
  yahooClose: number;
  quoteDeviationPct: number;
  dailyVsLive: ChartDayComparison[];
  avgAbsDailyDeviationPct: number | null;
}

export interface PromptEvalTierResult {
  tier: AiCostTier;
  modelId: string;
  tokensUsed: number;
  avgAbsQuoteDeviationPct: number;
  avgAbsDailyDeviationPct: number | null;
  symbols: PromptEvalTierSymbol[];
}

export interface PromptEvalRagMeta {
  enabled: boolean;
  chunksRetrieved: number;
  chunkIds: string[];
  /** Short labels of retrieved passages shown to the model */
  snippets: string[];
  /** Firestore ragRetrievalLogs document id when persisted */
  retrievalLogId?: string;
}

/** Persisted RAG retrieval for an eval run (Firestore ragRetrievalLogs). */
export interface RagRetrievalLog {
  id: string;
  experimentId: string;
  completedAt: string;
  symbols: string[];
  chunkIds: string[];
  snippets: string[];
  sources: Array<'catalog' | 'news'>;
}

export interface PromptEvalImprovement {
  previousExperimentId: string | null;
  avgQuoteDeviationDeltaPct: number | null;
  avgDailyDeviationDeltaPct: number | null;
  bestTier: AiCostTier | null;
}

/** One golden-comparison run across all three LLM tiers vs Yahoo EOD. */
export interface PromptEvalExperiment {
  id: string;
  completedAt: string;
  promptVersion: string;
  /** Resolved template versions for quote/chart/news (see docs/PROMPT_ENGINEERING.md). */
  promptSuite?: PromptSuiteVersions;
  /** 30 trading-day EOD comparison vs Yahoo daily bars (new runs always set this). */
  evalWindowDays?: number;
  comparisonMode?: PromptEvalComparisonMode;
  priceConvention: ChartPriceConvention;
  /** Reference price source for comparison (Yahoo EOD or client/server cache). */
  goldenReference: 'yahoo' | 'cache';
  groundTruthSource?: string;
  rag: PromptEvalRagMeta;
  symbols: string[];
  golden: PromptEvalGoldenSymbol[];
  tiers: PromptEvalTierResult[];
  improvement: PromptEvalImprovement;
}

export interface PromptEvalHistory {
  records: PromptEvalExperiment[];
  lastRecord: PromptEvalExperiment | null;
}

/** Short API-facing result from POST /eval/prompt/test */
export interface PromptEvalTestSummary {
  experimentId: string;
  completedAt: string;
  promptVersion: string;
  evalWindowDays: number;
  comparisonMode: PromptEvalComparisonMode;
  symbolsTested: number;
  ragEnabled: boolean;
  bestTier: AiCostTier | null;
  avgQuoteDeviationPct: number;
  avgDailyDeviationPct: number | null;
  improvementVsPrevious: PromptEvalImprovement;
  /** One-line human-readable result */
  headline: string;
  tiers: Array<{
    tier: AiCostTier;
    modelId: string;
    avgQuoteDeviationPct: number;
    avgAbsDailyDeviationPct: number | null;
    tokensUsed: number;
  }>;
}

export interface PromptEvalTestResult {
  summary: PromptEvalTestSummary;
  experiment: PromptEvalExperiment;
}

export type PromptEvalJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type PromptEvalStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface PromptEvalJobSetupStep {
  id: string;
  label: string;
  status: PromptEvalStepStatus;
  detail?: string;
}

/** Live progress for one LLM tier during a 30-day prompt eval job. */
export interface PromptEvalJobTierStep {
  tier: AiCostTier;
  label: string;
  modelId?: string;
  status: PromptEvalStepStatus;
  /** 0–100 for UI progress bar */
  progress: number;
  /** Short model reasoning from the quote scrape response */
  reasoning?: string;
  error?: string;
  tokensUsed?: number;
  avgQuoteDeviationPct?: number;
}

/** In-memory job for async POST /eval/prompt/jobs (polled by the floating queue UI). */
export interface PromptEvalJob {
  id: string;
  status: PromptEvalJobStatus;
  promptVersion: string;
  ragEnabled: boolean;
  symbolLimit?: number;
  phaseLabel: string;
  progress: { completed: number; total: number };
  setupSteps: PromptEvalJobSetupStep[];
  tiers: PromptEvalJobTierStep[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  experiment?: PromptEvalExperiment;
  summary?: PromptEvalTestSummary;
}

export type UsageLimitScope = 'agent-run' | 'prompt-test';

export interface AiUsageLimitsStatus {
  agentRun: PromptEvalCooldownStatus;
  promptTest: PromptEvalCooldownStatus;
}

export interface PromptEvalCooldownStatus {
  allowed: boolean;
  /** User presented a valid login token */
  authenticated: boolean;
  /** @deprecated Use `authenticated` — still true when signed in */
  authenticatedBypass: boolean;
  cooldownMs: number;
  remainingMs: number;
  nextAllowedAt: string | null;
  /** Set when authenticated: max runs per calendar day (UTC) */
  dailyLimit: number | null;
  dailyRunsUsed: number | null;
  dailyRunsRemaining: number | null;
  blockReason: 'cooldown' | 'daily_limit' | null;
}
