import type { AgentScrapeUsage } from './agentScrape.js';
import type { AiCostTier } from './aiEstimate.js';
import type { AgentChartEvalRecord } from './chartEval.js';
import type { AgentEstimateEvalRecord, AgentEstimateSnapshot } from './estimateEval.js';

export type AgentJobStepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

export type AgentJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface AgentJobStep {
  id: string;
  label: string;
  symbols?: string[];
  status: AgentJobStepStatus;
  error?: string;
  tokensUsed?: number;
}

export interface AgentScrapeJob {
  id: string;
  status: AgentJobStatus;
  tier: AiCostTier;
  forceLive: boolean;
  /** When true, scrape 30-day OHLC via LLM instead of synthetic drift only */
  scrapeCharts?: boolean;
  /** When true (default), quotes come from Live/Mock — job runs chart LLM steps only */
  chartsOnly?: boolean;
  steps: AgentJobStep[];
  progress: { completed: number; total: number };
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
  usage?: AgentScrapeUsage;
  /** Pre-scrape estimate for the job tier (captured at run start) */
  estimateSnapshot?: AgentEstimateSnapshot;
  /** Actual vs estimate after completion */
  estimateEval?: AgentEstimateEvalRecord;
  chartEval?: AgentChartEvalRecord;
}
