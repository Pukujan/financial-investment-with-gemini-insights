import type { AgentEstimateEvalRecord } from '@investai/shared';
import { AI_COST_TIER_LABELS, isZeroTokenUsage } from '@investai/shared';
import { formatUsd } from '../../../ai-estimate/utils/formatUsd';

function formatTokens(n: number): string {
  return n.toLocaleString();
}

function formatDeltaPercent(p: number | null): string {
  if (p == null) return '—';
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

function DiffRow({
  label,
  estimated,
  actual,
  format = 'number',
}: {
  label: string;
  estimated: number;
  actual: number;
  format?: 'number' | 'usd';
}) {
  const delta = actual - estimated;
  const deltaPct = estimated !== 0 ? (delta / estimated) * 100 : null;
  const fmt = (n: number) => (format === 'usd' ? formatUsd(n) : formatTokens(n));

  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2 font-medium text-slate-800">{label}</td>
      <td className="px-3 py-2 text-right text-slate-600">{fmt(estimated)}</td>
      <td className="px-3 py-2 text-right font-medium text-slate-900">{fmt(actual)}</td>
      <td className="px-3 py-2 text-right text-slate-600">
        {delta >= 0 ? '+' : ''}
        {format === 'usd' ? formatUsd(delta) : formatTokens(delta)}
      </td>
      <td className="px-3 py-2 text-right text-slate-600">{formatDeltaPercent(deltaPct)}</td>
    </tr>
  );
}

interface EstimateEvalRunDetailProps {
  record: AgentEstimateEvalRecord;
}

export function EstimateEvalRunDetail({ record }: EstimateEvalRunDetailProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-semibold text-slate-900">Estimate vs actual</h3>
        <p className="text-xs text-slate-600 mt-1">
          {AI_COST_TIER_LABELS[record.tier]}
          {record.modelId ? ` · ${record.modelId}` : ''} ·{' '}
          {new Date(record.completedAt).toLocaleString()}
          {isZeroTokenUsage({ tokensUsed: record.actual.tokens.total })
            ? ' · fully cached (0 tokens)'
            : ''}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 bg-white">
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium text-right">Estimated</th>
              <th className="px-3 py-2 font-medium text-right">Actual</th>
              <th className="px-3 py-2 font-medium text-right">Delta</th>
              <th className="px-3 py-2 font-medium text-right">Δ %</th>
            </tr>
          </thead>
          <tbody>
            <DiffRow
              label="Prompt tokens"
              estimated={record.estimate.estimatedTokens.prompt}
              actual={record.actual.tokens.prompt}
            />
            <DiffRow
              label="Completion tokens"
              estimated={record.estimate.estimatedTokens.completion}
              actual={record.actual.tokens.completion}
            />
            <DiffRow
              label="Total tokens"
              estimated={record.estimate.estimatedTokens.total}
              actual={record.actual.tokens.total}
            />
            <DiffRow
              label="Cost (USD)"
              estimated={record.estimate.estimatedCostUsd}
              actual={record.actual.costUsd}
              format="usd"
            />
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
        Pre-run snapshot: {record.estimate.symbolCount} symbols · quotes{' '}
        {record.estimate.quotesFullyCached ? 'cached' : 'live'} · news{' '}
        {record.estimate.newsCached ? 'cached' : 'live'}
      </p>
    </section>
  );
}
