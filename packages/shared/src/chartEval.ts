import type { ChartDayComparison, ChartPriceConvention } from './tradingDays.js';

/** Per-symbol price alignment between quote scrape and chart series */
export interface AgentChartSymbolEval {
  symbol: string;
  quotePrice: number;
  syntheticLastClose: number;
  llmLastClose: number | null;
  /** % diff: quote vs synthetic last close */
  quoteVsSyntheticPct: number;
  /** % diff: quote vs LLM last close (when charts scraped) */
  quoteVsLlmPct: number | null;
  /** % diff: synthetic vs LLM last close */
  syntheticVsLlmPct: number | null;
  /** Agent vs Yahoo EOD close per trading day (when live reference fetched). */
  dailyVsLive?: ChartDayComparison[];
  /** Avg |deviationPct| across days with live data */
  avgAbsLiveDeviationPct?: number | null;
  /** Latest trading day agent vs live */
  latestDayLiveDeviationPct?: number | null;
}

export interface AgentChartEvalSummary {
  symbolCount: number;
  avgQuoteVsSyntheticPct: number;
  avgAbsQuoteVsSyntheticPct: number;
  avgQuoteVsLlmPct: number | null;
  avgAbsQuoteVsLlmPct: number | null;
  maxAbsQuoteVsLlmPct: number | null;
  /** Mean of per-symbol avg |agent − Yahoo| % when live reference present */
  avgAbsLiveDeviationPct?: number | null;
}

export interface AgentChartEvalRecord {
  jobId: string;
  completedAt: string;
  chartMode: 'synthetic' | 'llm';
  scrapeCharts: boolean;
  /** Both agent and Yahoo series use daily EOD closes (last bar = latest session). */
  priceConvention: ChartPriceConvention;
  liveReference?: 'yahoo' | 'none';
  symbols: AgentChartSymbolEval[];
  summary: AgentChartEvalSummary;
}

export interface AgentChartEvalHistory {
  records: AgentChartEvalRecord[];
  lastRecord: AgentChartEvalRecord | null;
}
