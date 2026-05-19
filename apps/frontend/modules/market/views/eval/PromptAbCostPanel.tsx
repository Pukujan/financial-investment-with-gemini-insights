import type { PromptAbTestExperiment } from '@investai/shared';
import { AI_COST_TIER_LABELS } from '@investai/shared';
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

interface PromptAbCostPanelProps {
  record: PromptAbTestExperiment;
}

export function PromptAbCostPanel({ record }: PromptAbCostPanelProps) {
  const ce = record.costEval;
  if (!ce) {
    return (
      <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">
        Cost metrics not recorded for this run (re-run A/B test for estimate vs actual).
      </p>
    );
  }

  const eff = record.efficiency;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900">Estimate vs actual (both arms)</h3>
          <p className="text-xs text-slate-600 mt-1">
            {AI_COST_TIER_LABELS[record.tier]} · accuracy rating:{' '}
            <strong>{ce.accuracy}</strong>
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
                estimated={ce.estimate.estimatedTokens.prompt}
                actual={ce.actual.tokens.prompt}
              />
              <DiffRow
                label="Completion tokens"
                estimated={ce.estimate.estimatedTokens.completion}
                actual={ce.actual.tokens.completion}
              />
              <DiffRow
                label="Total tokens"
                estimated={ce.estimate.estimatedTokens.total}
                actual={ce.actual.tokens.total}
              />
              <DiffRow
                label="Cost (USD)"
                estimated={ce.estimate.estimatedCostUsd}
                actual={ce.actual.costUsd}
                format="usd"
              />
            </tbody>
          </table>
        </div>
      </div>

      {eff && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900 text-sm">Efficiency (accuracy per spend)</h3>
          <p className="text-xs text-slate-600 mt-1 mb-3">
            Lower deviation% per 1k tokens = better. Compares quote accuracy against token and dollar
            cost per arm.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-100">
                  <th className="py-2 text-left">Arm</th>
                  <th className="py-2 text-right">Tokens</th>
                  <th className="py-2 text-right">Cost</th>
                  <th className="py-2 text-right">Dev % / 1k tok</th>
                  <th className="py-2 text-right">Dev % / $0.01</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="py-2 font-medium text-indigo-700">A {record.resolvedVersionA}</td>
                  <td className="py-2 text-right">{formatTokens(record.armA.tokensUsed)}</td>
                  <td className="py-2 text-right">{formatUsd(record.armA.costUsd ?? 0)}</td>
                  <td className="py-2 text-right">{eff.armA.accuracyPer1kTokens.toFixed(3)}</td>
                  <td className="py-2 text-right">{eff.armA.accuracyPerCentUsd.toFixed(3)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-emerald-700">B {record.resolvedVersionB}</td>
                  <td className="py-2 text-right">{formatTokens(record.armB.tokensUsed)}</td>
                  <td className="py-2 text-right">{formatUsd(record.armB.costUsd ?? 0)}</td>
                  <td className="py-2 text-right">{eff.armB.accuracyPer1kTokens.toFixed(3)}</td>
                  <td className="py-2 text-right">{eff.armB.accuracyPerCentUsd.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-3 text-slate-700">
            More efficient: <strong>{eff.moreEfficientArm}</strong>
            {eff.accuracyPerTokenGainPct != null && (
              <>
                {' '}
                · B vs A accuracy/1k-token gain:{' '}
                <strong>
                  {eff.accuracyPerTokenGainPct > 0 ? '+' : ''}
                  {eff.accuracyPerTokenGainPct.toFixed(1)}%
                </strong>
              </>
            )}
            {eff.costDeltaUsd !== 0 && (
              <>
                {' '}
                · B cost delta vs A:{' '}
                <strong>
                  {eff.costDeltaUsd > 0 ? '+' : ''}
                  {formatUsd(eff.costDeltaUsd)}
                </strong>
              </>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
