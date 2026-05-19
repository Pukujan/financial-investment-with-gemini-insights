import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AgentChartEvalHistory,
  AgentChartEvalRecord,
  AgentChartSymbolEval,
  AgentScrapeJob,
  StockQuote,
  TimeSeriesData,
} from '@investai/shared';
import { buildDailyVsLive, CHART_EOD_CONVENTION } from '@investai/shared';
import { firestoreCollections } from '../../../config/cache.js';
import {
  loadEvalFromAllSources,
  mergeEvalById,
  persistEvalTriple,
} from '../../../utils/evalPersistence.js';
import { loadEvalHistoryFromDisk } from '../../../utils/evalDiskStore.js';

const MAX_HISTORY = 50;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.resolve(__dirname, '../../../../.data/chart-eval-history.json');

const history: AgentChartEvalRecord[] = loadEvalHistoryFromDisk(
  HISTORY_FILE,
  (item): item is AgentChartEvalRecord =>
    Boolean(item && typeof item === 'object' && typeof (item as AgentChartEvalRecord).jobId === 'string')
);

function pctDiff(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

function lastClose(series: TimeSeriesData[]): number {
  const last = series[series.length - 1];
  return last?.close ?? 0;
}

function avgAbsLiveDeviation(
  daily: AgentChartSymbolEval['dailyVsLive']
): number | null {
  if (!daily?.length) return null;
  const vals = daily
    .map(d => d.deviationPct)
    .filter((p): p is number => p != null)
    .map(Math.abs);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function buildChartEval(
  job: AgentScrapeJob,
  quotes: StockQuote[],
  seriesLlm: Record<string, TimeSeriesData[]>,
  seriesSynthetic: Record<string, TimeSeriesData[]>,
  liveSeriesBySymbol?: Record<string, TimeSeriesData[]>
): AgentChartEvalRecord | null {
  if (!job.completedAt) return null;

  const scrapeCharts = job.scrapeCharts !== false;
  const hasLive = Boolean(liveSeriesBySymbol && Object.keys(liveSeriesBySymbol).length > 0);
  const symbols: AgentChartSymbolEval[] = [];

  for (const q of quotes) {
    const sym = q.symbol.toUpperCase();
    const synthetic = seriesSynthetic[sym];
    if (!synthetic?.length) continue;

    const quotePrice = q.price;
    const syntheticLastClose = lastClose(synthetic);
    const llmSeries = seriesLlm[sym];
    const llmLastClose = llmSeries?.length ? lastClose(llmSeries) : null;
    const agentSeries =
      scrapeCharts && llmSeries?.length ? llmSeries : synthetic;
    const liveSeries = liveSeriesBySymbol?.[sym];
    const dailyVsLive =
      liveSeries?.length && agentSeries.length
        ? buildDailyVsLive(agentSeries, liveSeries)
        : undefined;
    const avgAbs = avgAbsLiveDeviation(dailyVsLive);
    const latestDay = dailyVsLive?.[dailyVsLive.length - 1];

    symbols.push({
      symbol: sym,
      quotePrice,
      syntheticLastClose,
      llmLastClose,
      quoteVsSyntheticPct: pctDiff(quotePrice, syntheticLastClose),
      quoteVsLlmPct: llmLastClose != null ? pctDiff(quotePrice, llmLastClose) : null,
      syntheticVsLlmPct:
        llmLastClose != null ? pctDiff(syntheticLastClose, llmLastClose) : null,
      dailyVsLive,
      avgAbsLiveDeviationPct: avgAbs,
      latestDayLiveDeviationPct: latestDay?.deviationPct ?? null,
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
  const liveDev = symbols
    .map(s => s.avgAbsLiveDeviationPct)
    .filter((p): p is number => p != null);

  return {
    jobId: job.id,
    completedAt: job.completedAt,
    chartMode: scrapeCharts ? 'llm' : 'synthetic',
    scrapeCharts,
    priceConvention: CHART_EOD_CONVENTION,
    liveReference: hasLive ? 'yahoo' : 'none',
    symbols,
    summary: {
      symbolCount: symbols.length,
      avgQuoteVsSyntheticPct: avg(quoteVsSynthetic),
      avgAbsQuoteVsSyntheticPct: avg(quoteVsSynthetic.map(abs)),
      avgQuoteVsLlmPct: quoteVsLlm.length > 0 ? avg(quoteVsLlm) : null,
      avgAbsQuoteVsLlmPct: quoteVsLlm.length > 0 ? avg(quoteVsLlm.map(abs)) : null,
      maxAbsQuoteVsLlmPct:
        quoteVsLlm.length > 0 ? Math.max(...quoteVsLlm.map(abs)) : null,
      avgAbsLiveDeviationPct: liveDev.length > 0 ? avg(liveDev) : null,
    },
  };
}

export function mergeChartEvalRecords(
  ...groups: AgentChartEvalRecord[][]
): AgentChartEvalHistory {
  const records = mergeEvalById(r => r.jobId, MAX_HISTORY, ...groups);
  return { records, lastRecord: records[0] ?? null };
}

export async function recordChartEval(record: AgentChartEvalRecord): Promise<void> {
  await persistEvalTriple({
    collection: firestoreCollections.chartEval,
    docId: record.jobId,
    record,
    memory: history,
    diskPath: HISTORY_FILE,
    maxHistory: MAX_HISTORY,
    getId: r => r.jobId,
  });
}

export async function getChartEvalHistory(): Promise<AgentChartEvalHistory> {
  const { records } = await loadEvalFromAllSources({
    collection: firestoreCollections.chartEval,
    memory: history,
    diskPath: HISTORY_FILE,
    maxRecords: MAX_HISTORY,
    getId: r => r.jobId,
    validate: (item): item is AgentChartEvalRecord =>
      Boolean(item && typeof item === 'object' && typeof (item as AgentChartEvalRecord).jobId === 'string'),
  });
  return { records, lastRecord: records[0] ?? null };
}

export async function syncChartEvalFromClient(
  records: AgentChartEvalRecord[]
): Promise<AgentChartEvalHistory> {
  for (const record of records) {
    if (!record?.jobId) continue;
    await recordChartEval(record);
  }
  return getChartEvalHistory();
}
