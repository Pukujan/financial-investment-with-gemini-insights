import { useMemo, useState } from 'react';
import type { PromptAbTestExperiment } from '@investai/shared';
import { AI_COST_TIER_LABELS } from '@investai/shared';
import { EvalSymbolPicker } from '@/modules/market/views/eval/EvalSymbolPicker';
import { PromptAbCharts } from './PromptAbCharts';
import { PromptAbCostPanel } from './PromptAbCostPanel';
import { PromptAbInsightPanel } from './PromptAbInsightPanel';

interface PromptAbRunDetailProps {
  record: PromptAbTestExperiment;
}

export function PromptAbRunDetail({ record }: PromptAbRunDetailProps) {
  const symbols = record.symbols.map(s => s.toUpperCase());
  const [symbol, setSymbol] = useState(symbols[0] ?? '');

  const logExcerpt = useMemo(() => {
    const lines: string[] = [
      `[${record.completedAt}] A/B id=${record.id}`,
      `groundTruth=${record.groundTruthSource} (${record.goldenReference})`,
      `tier=${record.tier} (${AI_COST_TIER_LABELS[record.tier] ?? record.tier})`,
    ];
    if (record.costEval) {
      lines.push(
        `cost est $${record.costEval.estimate.estimatedCostUsd.toFixed(4)} actual $${record.costEval.actual.costUsd.toFixed(4)} (${record.costEval.costDeltaPercent?.toFixed(1) ?? '—'}%)`
      );
    }
    lines.push(
      `A ${record.versionA}: quote ${record.armA.avgAbsQuoteDeviationPct.toFixed(2)}% · ${record.armA.tokensUsed} tok · $${(record.armA.costUsd ?? 0).toFixed(4)}`,
      `B ${record.versionB}: quote ${record.armB.avgAbsQuoteDeviationPct.toFixed(2)}% · ${record.armB.tokensUsed} tok · $${(record.armB.costUsd ?? 0).toFixed(4)}`,
      `winner=${record.winner.overall} · efficiency=${record.efficiency?.moreEfficientArm ?? '—'}`
    );
    if (record.armA.reasoning) lines.push(`\n--- Arm A reasoning ---\n${record.armA.reasoning}`);
    if (record.armB.reasoning) lines.push(`\n--- Arm B reasoning ---\n${record.armB.reasoning}`);
    if (record.engineeringInsight?.summary) {
      lines.push(`\n--- AI insight ---\n${record.engineeringInsight.summary}`);
    }
    return lines.join('\n');
  }, [record]);

  const winnerBadge =
    record.winner.overall === 'tie'
      ? 'Tie'
      : `Winner: ${record.winner.overall} (${record.winner.overall === 'A' ? record.resolvedVersionA : record.resolvedVersionB})`;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900">A/B test detail</h3>
          <p className="text-xs text-slate-600 mt-1">
            <strong>{record.resolvedVersionA}</strong> vs <strong>{record.resolvedVersionB}</strong>{' '}
            · {record.evalWindowDays}-day EOD vs Live cached ground truth · {winnerBadge}
          </p>
          <p className="text-xs mt-2 text-emerald-800 bg-emerald-50 rounded px-2 py-1 inline-block">
            {record.headline}
          </p>
        </div>
        <pre className="px-4 py-3 text-[11px] text-slate-700 bg-slate-900/5 overflow-x-auto whitespace-pre-wrap font-mono border-b border-slate-100 max-h-48 overflow-y-auto">
          {logExcerpt}
        </pre>
      </div>

      <PromptAbCostPanel record={record} />
      <PromptAbInsightPanel insight={record.engineeringInsight} />

      <EvalSymbolPicker symbols={symbols} value={symbol} onChange={setSymbol} />
      {symbol ? <PromptAbCharts record={record} symbol={symbol} /> : null}
    </section>
  );
}
