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
}

export interface AgentChartEvalSummary {
  symbolCount: number;
  avgQuoteVsSyntheticPct: number;
  avgAbsQuoteVsSyntheticPct: number;
  avgQuoteVsLlmPct: number | null;
  avgAbsQuoteVsLlmPct: number | null;
  maxAbsQuoteVsLlmPct: number | null;
}

export interface AgentChartEvalRecord {
  jobId: string;
  completedAt: string;
  chartMode: 'synthetic' | 'llm';
  scrapeCharts: boolean;
  symbols: AgentChartSymbolEval[];
  summary: AgentChartEvalSummary;
}

export interface AgentChartEvalHistory {
  records: AgentChartEvalRecord[];
  lastRecord: AgentChartEvalRecord | null;
}
