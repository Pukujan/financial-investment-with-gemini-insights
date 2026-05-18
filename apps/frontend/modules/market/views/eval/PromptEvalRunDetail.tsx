import { useEffect, useMemo, useState } from 'react';
import type { PromptEvalExperiment, RagRetrievalLog } from '@investai/shared';
import { AI_COST_TIER_LABELS } from '@investai/shared';
import { promptEvalApi } from '../../services/promptEvalApi';
import { RagFlowPanel } from './RagFlowPanel';
import { PromptEvalCharts } from './PromptEvalCharts';
import { EvalSymbolPicker } from './EvalSymbolPicker';

interface PromptEvalRunDetailProps {
  record: PromptEvalExperiment;
}

export function PromptEvalRunDetail({ record }: PromptEvalRunDetailProps) {
  const symbols = record.symbols.map(s => s.toUpperCase());
  const [symbol, setSymbol] = useState(symbols[0] ?? '');
  const [ragLogs, setRagLogs] = useState<RagRetrievalLog[]>([]);

  useEffect(() => {
    if (!record.rag.enabled || !record.id) {
      setRagLogs([]);
      return;
    }
    void promptEvalApi
      .getRagLog(record.id)
      .then(res => setRagLogs(res.logs))
      .catch(() => setRagLogs([]));
  }, [record.id, record.rag.enabled]);

  const imp = record.improvement;

  const logExcerpt = useMemo(() => {
    const lines: string[] = [
      `[${record.completedAt}] prompt=${record.promptVersion} id=${record.id}`,
      `golden=yahoo symbols=${record.symbols.join(',')}`,
    ];
    for (const t of record.tiers) {
      lines.push(
        `  tier ${t.tier} (${t.modelId}): quoteDev=${t.avgAbsQuoteDeviationPct.toFixed(2)}% dailyDev=${t.avgAbsDailyDeviationPct?.toFixed(2) ?? '—'}% tokens=${t.tokensUsed}`
      );
    }
    if (record.rag.enabled) {
      lines.push(`  RAG chunks=${record.rag.chunksRetrieved} ids=${record.rag.chunkIds.join(', ')}`);
    }
    if (imp.previousExperimentId) {
      lines.push(
        `  vs prev ${imp.previousExperimentId}: quoteΔ=${imp.avgQuoteDeviationDeltaPct?.toFixed(2) ?? '—'}%`
      );
    }
    return lines.join('\n');
  }, [record, imp]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-semibold text-slate-900">Run log</h3>
          <p className="text-xs text-slate-600 mt-1">
            Prompt <strong>{record.promptVersion}</strong> ·{' '}
            <strong>{record.evalWindowDays ?? 30}-day</strong> EOD vs Yahoo · {record.tiers.length}{' '}
            tiers · detail below / Firestore when configured
          </p>
          {imp.previousExperimentId && (
            <p className="text-xs mt-2 text-violet-800 bg-violet-50 rounded px-2 py-1 inline-block">
              vs previous: quote Δ{' '}
              {imp.avgQuoteDeviationDeltaPct != null
                ? `${imp.avgQuoteDeviationDeltaPct > 0 ? '+' : ''}${imp.avgQuoteDeviationDeltaPct.toFixed(2)}%`
                : '—'}
              {imp.avgDailyDeviationDeltaPct != null &&
                ` · daily Δ ${imp.avgDailyDeviationDeltaPct > 0 ? '+' : ''}${imp.avgDailyDeviationDeltaPct.toFixed(2)}%`}
              {imp.bestTier && ` · best: ${AI_COST_TIER_LABELS[imp.bestTier] ?? imp.bestTier}`}
            </p>
          )}
        </div>

        <pre className="px-4 py-3 text-[11px] text-slate-700 bg-slate-900/5 overflow-x-auto whitespace-pre-wrap font-mono border-b border-slate-100">
          {logExcerpt}
        </pre>
      </div>

      <RagFlowPanel rag={record.rag} active={record.rag.enabled} ragLogs={ragLogs} />

      <EvalSymbolPicker symbols={symbols} value={symbol} onChange={setSymbol} />

      <PromptEvalCharts record={record} symbol={symbol} />
    </section>
  );
}
