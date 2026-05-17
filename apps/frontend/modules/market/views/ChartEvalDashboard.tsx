import { useCallback, useEffect, useState } from 'react';
import { LineChart } from 'lucide-react';
import type { AgentChartEvalHistory, AgentChartEvalRecord } from '@investai/shared';
import { chartEvalApi } from '../services/chartEvalApi';
import { loadAgentQueuePrefs } from '../utils/agentQueueStorage';
import {
  loadLocalChartEvals,
  mergeChartEvalHistory,
  persistChartEvalRecord,
} from '../utils/chartEvalStorage';

function formatPct(p: number | null): string {
  if (p == null) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(2)}%`;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function LatestTable({ record }: { record: AgentChartEvalRecord }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Latest price alignment</h3>
        <span className="text-xs text-slate-500">
          {record.chartMode === 'llm' ? 'LLM 30-day charts' : 'Synthetic charts only'} ·{' '}
          {new Date(record.completedAt).toLocaleString()}
        </span>
      </div>
      <p className="px-4 py-2 text-xs text-slate-600 bg-slate-50 border-b border-slate-100">
        Compares scraped quote price to the last close on synthetic drift vs LLM-scraped OHLC (when
        enabled). Large gaps mean the model quote and chart series disagree.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 bg-slate-50">
              <th className="px-4 py-2 font-medium">Symbol</th>
              <th className="px-4 py-2 font-medium text-right">Quote</th>
              <th className="px-4 py-2 font-medium text-right">Synthetic close</th>
              <th className="px-4 py-2 font-medium text-right">Quote vs synth</th>
              {record.scrapeCharts && (
                <>
                  <th className="px-4 py-2 font-medium text-right">LLM close</th>
                  <th className="px-4 py-2 font-medium text-right">Quote vs LLM</th>
                  <th className="px-4 py-2 font-medium text-right">Synth vs LLM</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {record.symbols.map(row => (
              <tr key={row.symbol} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{row.symbol}</td>
                <td className="px-4 py-2 text-right">${row.quotePrice.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${row.syntheticLastClose.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-slate-600">
                  {formatPct(row.quoteVsSyntheticPct)}
                </td>
                {record.scrapeCharts && (
                  <>
                    <td className="px-4 py-2 text-right">
                      {row.llmLastClose != null ? `$${row.llmLastClose.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">{formatPct(row.quoteVsLlmPct)}</td>
                    <td className="px-4 py-2 text-right">{formatPct(row.syntheticVsLlmPct)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ChartEvalDashboard() {
  const [history, setHistory] = useState<AgentChartEvalHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const collectLocal = useCallback(() => {
    const local = loadLocalChartEvals();
    const lastJob = loadAgentQueuePrefs().lastJob;
    if (lastJob?.chartEval) {
      persistChartEvalRecord(lastJob.chartEval);
      const without = local.filter(r => r.jobId !== lastJob.chartEval!.jobId);
      return [...without, lastJob.chartEval];
    }
    return local;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const localRecords = collectLocal();
    try {
      const api = await chartEvalApi.getHistory();
      setHistory(mergeChartEvalHistory(api.records, localRecords));
    } catch (err) {
      if (localRecords.length > 0) {
        setHistory(mergeChartEvalHistory([], localRecords));
        setError('Server history unavailable — showing saved runs from this browser.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not load chart eval history');
      }
    } finally {
      setLoading(false);
    }
  }, [collectLocal]);

  useEffect(() => {
    void load();
  }, [load]);

  const last = history?.lastRecord;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <LineChart className="w-7 h-7 text-violet-600" />
          <h2 className="text-2xl font-semibold text-slate-900">Chart price comparison</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600 max-w-2xl">
          After each agent scrape, compares the quote price to 30-day chart last closes — synthetic
          drift vs optional LLM-scraped OHLC. Enable &quot;Scrape 30-day charts&quot; when starting a
          job to populate LLM columns.
        </p>
      </div>

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && !history && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && !last && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          No chart eval data yet. Run an agent scrape to see quote vs chart alignment.
        </div>
      )}

      {last && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Symbols" value={String(last.summary.symbolCount)} />
            <SummaryCard
              label="Avg |quote − synthetic|"
              value={`${last.summary.avgAbsQuoteVsSyntheticPct.toFixed(2)}%`}
            />
            {last.scrapeCharts && last.summary.avgAbsQuoteVsLlmPct != null && (
              <>
                <SummaryCard
                  label="Avg |quote − LLM|"
                  value={`${last.summary.avgAbsQuoteVsLlmPct.toFixed(2)}%`}
                />
                <SummaryCard
                  label="Max |quote − LLM|"
                  value={`${last.summary.maxAbsQuoteVsLlmPct?.toFixed(2) ?? '—'}%`}
                />
              </>
            )}
          </div>
          <LatestTable record={last} />
        </>
      )}
    </div>
  );
}
