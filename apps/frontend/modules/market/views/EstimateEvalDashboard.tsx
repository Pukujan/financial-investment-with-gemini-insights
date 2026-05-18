import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import type { AgentEstimateEvalHistory, EstimateAccuracyRating } from '@investai/shared';
import { AI_COST_TIER_LABELS } from '@investai/shared';
import { estimateEvalApi } from '../services/estimateEvalApi';
import {
  collectAllLocalEstimateEvals,
  mergeEstimateEvalHistory,
  persistEstimateEvalRecord,
} from '../utils/estimateEvalStorage';
import { loadEvalWithSync } from '../utils/evalStorageSync';
import { EvalRunTimeline, type EvalTimelineItem } from './eval/EvalRunTimeline';
import { EstimateEvalRunDetail } from './eval/EstimateEvalRunDetail';

const ACCURACY_STYLES: Record<EstimateAccuracyRating, string> = {
  excellent: 'bg-emerald-100 text-emerald-800',
  good: 'bg-green-100 text-green-800',
  fair: 'bg-amber-100 text-amber-800',
  poor: 'bg-red-100 text-red-800',
  cached: 'bg-slate-100 text-slate-700',
  unknown: 'bg-slate-100 text-slate-600',
};

function formatDeltaPercent(p: number | null): string {
  if (p == null) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

export function EstimateEvalDashboard() {
  const [history, setHistory] = useState<AgentEstimateEvalHistory | null>(null);
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
          const records = collectAllLocalEstimateEvals();
          for (const r of records) persistEstimateEvalRecord(r);
          return records;
        },
        getId: r => r.jobId,
        fetchServer: () => estimateEvalApi.getHistory(),
        syncToServer: records => estimateEvalApi.syncLocal(records),
        persistLocal: persistEstimateEvalRecord,
        merge: (api, local) => mergeEstimateEvalHistory(api, local),
      });
      setHistory(mergeEstimateEvalHistory(records, []));
      if (synced > 0) setSyncNote(`Synced ${synced} estimate eval run(s) to server + Firestore.`);
      setSelectedId(prev => {
        if (prev && records.some(r => r.jobId === prev)) return prev;
        return records[0]?.jobId ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load estimate eval history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const records = history?.records ?? [];
  const selected = useMemo(
    () => records.find(r => r.jobId === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  const timelineItems: EvalTimelineItem[] = useMemo(
    () =>
      records.map(r => ({
        id: r.jobId,
        completedAt: r.completedAt,
        title: AI_COST_TIER_LABELS[r.tier],
        subtitle: `Est. ${r.estimate.estimatedTokens.total.toLocaleString()} → actual ${r.actual.tokens.total.toLocaleString()} tokens`,
        badge: r.accuracy,
        badgeClassName: ACCURACY_STYLES[r.accuracy],
      })),
    [records]
  );

  const summary = history?.summary;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-6 h-6 text-violet-600" />
            <h2 className="text-2xl font-semibold text-slate-900">Estimate accuracy</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Each agent scrape captures a pre-run token estimate, then records actual OpenRouter
            usage. Click a run in the timeline to see estimated vs actual side by side.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Stored on server disk + this browser — not Firestore (eval logs are separate from market
            quote cache).
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

      {loading && !history && <p className="text-sm text-slate-500">Loading eval history…</p>}

      {!loading && records.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          No completed scrapes with eval data yet. Run an agent scrape in Agent mode.
        </div>
      )}

      {summary && summary.recordCount > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Scrapes tracked</p>
              <p className="text-xl font-semibold text-slate-900">{summary.recordCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Avg token delta</p>
              <p className="text-xl font-semibold text-slate-900">
                {formatDeltaPercent(summary.avgTokenDeltaPercent)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Avg cost delta</p>
              <p className="text-xl font-semibold text-slate-900">
                {formatDeltaPercent(summary.avgCostDeltaPercent)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,280px)_1fr] gap-6">
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
                <EstimateEvalRunDetail record={selected} />
              ) : (
                <p className="text-sm text-slate-500">Select a run to view details.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
