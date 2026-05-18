import { useCallback, useEffect, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import type {
  AgentEstimateEvalHistory,
  AgentEstimateEvalRecord,
  EstimateAccuracyRating,
} from '@investai/shared';
import { AI_COST_TIER_LABELS, isZeroTokenUsage } from '@investai/shared';
import { formatUsd } from '../../ai-estimate/utils/formatUsd';
import { estimateEvalApi } from '../services/estimateEvalApi';
import {
  collectAllLocalEstimateEvals,
  mergeEstimateEvalHistory,
  persistEstimateEvalRecord,
} from '../utils/estimateEvalStorage';

const ACCURACY_STYLES: Record<EstimateAccuracyRating, string> = {
  excellent: 'bg-emerald-100 text-emerald-800',
  good: 'bg-green-100 text-green-800',
  fair: 'bg-amber-100 text-amber-800',
  poor: 'bg-red-100 text-red-800',
  cached: 'bg-slate-100 text-slate-700',
  unknown: 'bg-slate-100 text-slate-600',
};

const ACCURACY_LABELS: Record<EstimateAccuracyRating, string> = {
  excellent: 'Excellent (≤10%)',
  good: 'Good (≤25%)',
  fair: 'Fair (≤50%)',
  poor: 'Poor (>50%)',
  cached: 'Fully cached (0 tokens)',
  unknown: 'Unknown',
};

function formatTokens(n: number): string {
  return n.toLocaleString();
}

function formatDeltaPercent(p: number | null): string {
  if (p == null) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

function TokenBar({
  label,
  estimated,
  actual,
}: {
  label: string;
  estimated: number;
  actual: number;
}) {
  const max = Math.max(estimated, actual, 1);
  const estPct = (estimated / max) * 100;
  const actPct = (actual / max) * 100;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-16 text-slate-500 shrink-0">Estimate</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${estPct}%` }} />
          </div>
          <span className="w-14 text-right text-slate-700">{formatTokens(estimated)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-16 text-slate-500 shrink-0">Actual</span>
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${actPct}%` }} />
          </div>
          <span className="w-14 text-right text-slate-700">{formatTokens(actual)}</span>
        </div>
      </div>
    </div>
  );
}

function LatestComparison({ record }: { record: AgentEstimateEvalRecord }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-slate-900">Latest scrape</h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${ACCURACY_STYLES[record.accuracy]}`}
        >
          {ACCURACY_LABELS[record.accuracy]}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {AI_COST_TIER_LABELS[record.tier]} ·{' '}
        {new Date(record.completedAt).toLocaleString()}
        {isZeroTokenUsage({ tokensUsed: record.actual.tokens.total })
          ? ' · fully cached (0 API tokens)'
          : record.estimate.quotesFullyCached
            ? ' · quotes were cached; news used tokens'
            : ''}
      </p>
      <TokenBar
        label="Total tokens"
        estimated={record.estimate.estimatedTokens.total}
        actual={record.actual.tokens.total}
      />
      <TokenBar
        label="Cost (USD)"
        estimated={Math.round(record.estimate.estimatedCostUsd * 10000)}
        actual={Math.round(record.actual.costUsd * 10000)}
      />
      <p className="text-xs text-slate-600">
        Token delta: {formatDeltaPercent(record.tokenDeltaPercent)} (
        {record.tokenDelta >= 0 ? '+' : ''}
        {formatTokens(record.tokenDelta)}) · Cost: {formatUsd(record.actual.costUsd)} actual vs{' '}
        {formatUsd(record.estimate.estimatedCostUsd)} estimated
      </p>
    </section>
  );
}

export function EstimateEvalDashboard() {
  const [history, setHistory] = useState<AgentEstimateEvalHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const collectLocalRecords = useCallback(() => {
    const records = collectAllLocalEstimateEvals();
    for (const record of records) {
      persistEstimateEvalRecord(record);
    }
    return records;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const localRecords = collectLocalRecords();
    try {
      const api = await estimateEvalApi.getHistory();
      const merged = mergeEstimateEvalHistory(api.records, localRecords);
      setHistory(merged);
    } catch (err) {
      if (localRecords.length > 0) {
        setHistory(mergeEstimateEvalHistory([], localRecords));
        setError(
          'Server history unavailable — showing saved runs from this browser only.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Could not load estimate eval history');
      }
    } finally {
      setLoading(false);
    }
  }, [collectLocalRecords]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = history?.summary;
  const records = history?.records ?? [];

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="w-6 h-6 text-violet-600" />
            <h2 className="text-2xl font-semibold text-slate-900">Estimate accuracy</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Each agent scrape captures a pre-run token estimate, then records actual OpenRouter
            usage when finished. Actual tokens are golden data for calibrating future estimates.
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

      {error && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading && !history && <p className="text-sm text-slate-500">Loading eval history…</p>}

      {!loading && records.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          No completed scrapes with eval data yet. Run an agent scrape in Agent mode — results
          appear here automatically.
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
            <div className="rounded-lg border border-slate-200 bg-white p-4 col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500 mb-1">Accuracy mix</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(summary.accuracyCounts ?? {}) as EstimateAccuracyRating[])
                  .filter(k => (summary.accuracyCounts?.[k] ?? 0) > 0)
                  .map(k => (
                    <span
                      key={k}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${ACCURACY_STYLES[k]}`}
                    >
                      {k} {summary.accuracyCounts?.[k] ?? 0}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {summary.lastRecord && <LatestComparison record={summary.lastRecord} />}

          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <h3 className="font-semibold text-slate-900 px-4 py-3 border-b border-slate-100">
              History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 bg-slate-50">
                    <th className="px-4 py-2 font-medium">When</th>
                    <th className="px-4 py-2 font-medium">Tier</th>
                    <th className="px-4 py-2 font-medium text-right">Est. tokens</th>
                    <th className="px-4 py-2 font-medium text-right">Actual</th>
                    <th className="px-4 py-2 font-medium text-right">Delta</th>
                    <th className="px-4 py-2 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(row => (
                    <tr key={row.jobId} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                        {new Date(row.completedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {AI_COST_TIER_LABELS[row.tier]}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {formatTokens(row.estimate.estimatedTokens.total)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-900">
                        {formatTokens(row.actual.tokens.total)}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        {formatDeltaPercent(row.tokenDeltaPercent)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${ACCURACY_STYLES[row.accuracy]}`}
                        >
                          {row.accuracy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
