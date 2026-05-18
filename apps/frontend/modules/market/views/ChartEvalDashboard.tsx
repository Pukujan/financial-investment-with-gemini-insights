import { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import type { AgentChartEvalHistory, AgentChartEvalRecord } from '@investai/shared';
import { chartEvalApi } from '../services/chartEvalApi';
import {
  collectAllLocalChartEvals,
  mergeChartEvalHistory,
  persistChartEvalRecord,
} from '../utils/chartEvalStorage';
import { loadEvalWithSync } from '../utils/evalStorageSync';
import { EvalRunTimeline, type EvalTimelineItem } from './eval/EvalRunTimeline';
import { EvalRunLogTable, type EvalLogRow } from './eval/EvalRunLogTable';
import { ChartEvalRunDetail } from './eval/ChartEvalRunDetail';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export function ChartEvalDashboard() {
  const [history, setHistory] = useState<AgentChartEvalHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSyncNote(null);
    try {
      const { records, synced } = await loadEvalWithSync({
        loadLocal: () => {
          const records = collectAllLocalChartEvals();
          for (const r of records) persistChartEvalRecord(r);
          return records;
        },
        getId: r => r.jobId,
        fetchServer: () => chartEvalApi.getHistory(),
        syncToServer: records => chartEvalApi.syncLocal(records),
        persistLocal: persistChartEvalRecord,
        merge: (api, local) => mergeChartEvalHistory(api, local),
      });
      setHistory({ records, lastRecord: records[0] ?? null });
      if (synced > 0) setSyncNote(`Synced ${synced} chart eval run(s) to server + Firestore.`);
      setSelectedId(prev => {
        if (prev && records.some(r => r.jobId === prev)) return prev;
        return records[0]?.jobId ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chart eval history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const records = history?.records ?? [];
  const selected: AgentChartEvalRecord | null = useMemo(
    () => records.find(r => r.jobId === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  const logRows: EvalLogRow[] = useMemo(
    () =>
      records.map(r => ({
        id: r.jobId,
        completedAt: r.completedAt,
        label: r.chartMode === 'llm' ? 'LLM 30-day' : 'Synthetic',
        detail: `${r.summary.symbolCount} symbols`,
        metric:
          r.summary.avgAbsLiveDeviationPct != null
            ? `${r.summary.avgAbsLiveDeviationPct.toFixed(1)}% avg`
            : '—',
      })),
    [records]
  );

  const timelineItems: EvalTimelineItem[] = useMemo(
    () =>
      records.map(r => ({
        id: r.jobId,
        completedAt: r.completedAt,
        title: r.chartMode === 'llm' ? 'LLM 30-day charts' : 'Synthetic EOD charts',
        subtitle: `${r.summary.symbolCount} symbols · avg |quote−synth| ${r.summary.avgAbsQuoteVsSyntheticPct.toFixed(1)}%${
          r.summary.avgAbsLiveDeviationPct != null
            ? ` · avg |agent−Yahoo| ${r.summary.avgAbsLiveDeviationPct.toFixed(1)}%`
            : ''
        }`,
        badge: r.liveReference === 'yahoo' ? 'Yahoo ref' : 'No live ref',
        badgeClassName:
          r.liveReference === 'yahoo'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-slate-100 text-slate-600',
      })),
    [records]
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <LineChartIcon className="w-7 h-7 text-violet-600" />
            <h2 className="text-2xl font-semibold text-slate-900">Agent run history & results</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Timeline of each agent scrape. Click a run to compare quote vs chart closes and — when
            available — day-by-day agent vs Yahoo EOD deviation.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Yahoo uses daily bars (<code className="text-[10px]">interval: 1d</code>): each point is
            the session close, not the open. Agent synthetic series now uses the same trading-day /
            EOD convention.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {syncNote && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {syncNote}
        </p>
      )}

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && !history && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && records.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          No chart eval data yet. Run an agent scrape to see quote vs chart alignment.
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Symbols" value={String(selected.summary.symbolCount)} />
          <SummaryCard
            label="Avg |quote − synthetic|"
            value={`${selected.summary.avgAbsQuoteVsSyntheticPct.toFixed(2)}%`}
          />
          {selected.summary.avgAbsLiveDeviationPct != null && (
            <SummaryCard
              label="Avg |agent − Yahoo| / day"
              value={`${selected.summary.avgAbsLiveDeviationPct.toFixed(2)}%`}
            />
          )}
        </div>
      )}

      {records.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Run log</h3>
          <EvalRunLogTable
            rows={logRows}
            selectedId={selected?.jobId ?? null}
            onSelect={setSelectedId}
          />
        </section>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,300px)_1fr] gap-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Run timeline</h3>
            <EvalRunTimeline
              items={timelineItems}
              selectedId={selected?.jobId ?? null}
              onSelect={setSelectedId}
            />
          </section>
          <div className="min-w-0">
            {selected ? (
              <ChartEvalRunDetail record={selected} />
            ) : (
              <p className="text-sm text-slate-500">Select a run to view details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
