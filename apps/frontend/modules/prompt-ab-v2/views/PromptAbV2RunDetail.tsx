import type { PromptAbV2CellResult, PromptAbV2Experiment } from '@investai/shared';
import { AI_COST_TIER_LABELS, PROMPT_AB_V2_PROMPT_LABELS } from '@investai/shared';
import { PromptAbV2Charts } from './PromptAbV2Charts';

interface PromptAbV2RunDetailProps {
  record: PromptAbV2Experiment;
  previousRecord: PromptAbV2Experiment | null;
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

function CellCard({ cell }: { cell: PromptAbV2CellResult }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-semibold text-slate-900">{cell.symbol}</span>
        <span className="text-slate-500">{AI_COST_TIER_LABELS[cell.tier]}</span>
        <span
          className={`rounded px-1.5 py-0.5 font-medium ${
            cell.prediction.direction === 'Bullish'
              ? 'bg-emerald-100 text-emerald-800'
              : cell.prediction.direction === 'Bearish'
                ? 'bg-red-100 text-red-800'
                : 'bg-slate-200 text-slate-700'
          }`}
        >
          {cell.prediction.direction} · {cell.prediction.confidenceScore}%
        </span>
      </div>
      <p className="text-slate-600">
        <span className="font-medium">Formula:</span> {cell.deterministic.formulaLabel}
      </p>
      <p className="text-slate-600 line-clamp-2">{cell.systemPromptExcerpt}</p>
      <details className="text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">Prompt & reasoning</summary>
        <p className="mt-1 whitespace-pre-wrap">{cell.userPromptExcerpt}</p>
        <ul className="mt-2 list-disc pl-4 space-y-0.5">
          {cell.prediction.reasoningSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function PromptAbV2RunDetail({
  record,
  previousRecord,
  selectedSymbol,
  onSymbolChange,
}: PromptAbV2RunDetailProps) {
  const delta = record.runDelta;
  const cellsForSymbol = record.matrix.filter(c => c.symbol === selectedSymbol);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">{record.headline}</h3>
        <p className="text-sm text-slate-600 mt-1">
          {record.symbols.length} symbols × {record.promptIds.length} prompts ×{' '}
          {record.tiers.length} models = {record.totalCells} hybrid LLM cells
        </p>
        {record.costEval && (
          <p className="text-xs text-slate-500 mt-2">
            Cost: ${record.costEval.actualCostUsd.toFixed(4)} (est $
            {record.costEval.estimatedCostUsd.toFixed(4)}) ·{' '}
            {record.costEval.tokens.total.toLocaleString()} tokens
          </p>
        )}
      </div>

      {delta && previousRecord && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h4 className="text-sm font-semibold text-amber-900">vs previous run</h4>
          <p className="text-xs text-amber-800 mt-1">
            Previous: {new Date(delta.previousCompletedAt ?? '').toLocaleString()}
          </p>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {record.promptIds.map(pid => (
              <div key={pid} className="text-xs">
                <span className="text-amber-700">{PROMPT_AB_V2_PROMPT_LABELS[pid].split(' ')[0]}</span>
                <p className="font-medium text-amber-900">
                  {delta.confidenceDeltaByPrompt[pid] != null
                    ? `${delta.confidenceDeltaByPrompt[pid]! >= 0 ? '+' : ''}${delta.confidenceDeltaByPrompt[pid]!.toFixed(1)}% conf`
                    : '—'}
                </p>
              </div>
            ))}
          </div>
          {delta.directionChangesBySymbol.length > 0 && (
            <p className="text-xs text-amber-800 mt-2">
              {delta.directionChangesBySymbol.length} direction change(s) vs previous run
            </p>
          )}
          {delta.costDeltaUsd != null && (
            <p className="text-xs text-amber-800 mt-1">
              Cost delta: {delta.costDeltaUsd >= 0 ? '+' : ''}${delta.costDeltaUsd.toFixed(4)}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {record.symbols.map(sym => (
          <button
            key={sym}
            type="button"
            onClick={() => onSymbolChange(sym)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedSymbol === sym
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      <PromptAbV2Charts record={record} symbol={selectedSymbol} />

      <section>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          Prompt arms for {selectedSymbol}
        </h4>
        <div className="grid gap-3 md:grid-cols-2">
          {cellsForSymbol.map(cell => (
            <CellCard key={`${cell.promptId}-${cell.tier}`} cell={cell} />
          ))}
        </div>
      </section>
    </div>
  );
}
