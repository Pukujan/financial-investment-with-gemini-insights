import type {
  AgentChartEvalHistory,
  AgentChartEvalRecord,
  AgentChartSymbolEval,
  AgentScrapeJob,
  StockQuote,
  TimeSeriesData,
} from '@investai/shared';

const MAX_HISTORY = 50;
const history: AgentChartEvalRecord[] = [];

function pctDiff(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

function lastClose(series: TimeSeriesData[]): number {
  const last = series[series.length - 1];
  return last?.close ?? 0;
}

export function buildChartEval(
  job: AgentScrapeJob,
  quotes: StockQuote[],
  seriesLlm: Record<string, TimeSeriesData[]>,
  seriesSynthetic: Record<string, TimeSeriesData[]>
): AgentChartEvalRecord | null {
  if (!job.completedAt) return null;

  const scrapeCharts = Boolean(job.scrapeCharts);
  const symbols: AgentChartSymbolEval[] = [];

  for (const q of quotes) {
    const sym = q.symbol.toUpperCase();
    const synthetic = seriesSynthetic[sym];
    if (!synthetic?.length) continue;

    const quotePrice = q.price;
    const syntheticLastClose = lastClose(synthetic);
    const llmSeries = seriesLlm[sym];
    const llmLastClose = llmSeries?.length ? lastClose(llmSeries) : null;

    symbols.push({
      symbol: sym,
      quotePrice,
      syntheticLastClose,
      llmLastClose,
      quoteVsSyntheticPct: pctDiff(quotePrice, syntheticLastClose),
      quoteVsLlmPct: llmLastClose != null ? pctDiff(quotePrice, llmLastClose) : null,
      syntheticVsLlmPct:
        llmLastClose != null ? pctDiff(syntheticLastClose, llmLastClose) : null,
    });
  }

  if (symbols.length === 0) return null;

  const abs = (n: number) => Math.abs(n);
  const avg = (vals: number[]) =>
    vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;

  const quoteVsSynthetic = symbols.map(s => s.quoteVsSyntheticPct);
  const quoteVsLlm = symbols
    .map(s => s.quoteVsLlmPct)
    .filter((p): p is number => p != null);

  return {
    jobId: job.id,
    completedAt: job.completedAt,
    chartMode: scrapeCharts ? 'llm' : 'synthetic',
    scrapeCharts,
    symbols,
    summary: {
      symbolCount: symbols.length,
      avgQuoteVsSyntheticPct: avg(quoteVsSynthetic),
      avgAbsQuoteVsSyntheticPct: avg(quoteVsSynthetic.map(abs)),
      avgQuoteVsLlmPct: quoteVsLlm.length > 0 ? avg(quoteVsLlm) : null,
      avgAbsQuoteVsLlmPct: quoteVsLlm.length > 0 ? avg(quoteVsLlm.map(abs)) : null,
      maxAbsQuoteVsLlmPct:
        quoteVsLlm.length > 0 ? Math.max(...quoteVsLlm.map(abs)) : null,
    },
  };
}

export function recordChartEval(record: AgentChartEvalRecord): void {
  const idx = history.findIndex(r => r.jobId === record.jobId);
  if (idx >= 0) history[idx] = record;
  else history.unshift(record);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
}

export function getChartEvalHistory(): AgentChartEvalHistory {
  const records = [...history];
  return { records, lastRecord: records[0] ?? null };
}
