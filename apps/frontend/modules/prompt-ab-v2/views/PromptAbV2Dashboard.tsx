import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, Play, RefreshCw } from 'lucide-react';
import type { PromptAbV2CostEstimate, PromptAbV2Experiment } from '@investai/shared';
import {
  AI_COST_TIERS,
  PROMPT_AB_V2_PROMPT_IDS,
  PROMPT_AB_V2_PROMPT_LABELS,
  PROMPT_AB_V2_SYMBOLS,
} from '@investai/shared';
import { EvalRunLogTable, type EvalLogRow } from '@/modules/market/views/eval/EvalRunLogTable';
import { formatUsd } from '@/modules/ai-estimate/utils/formatUsd';
import { ApiError } from '@/shared/api/http';
import { loadEvalWithSync } from '@/modules/market/utils/evalStorageSync';
import { usePromptAbV2Run } from '../controllers/PromptAbV2RunProvider';
import { promptAbV2Api } from '../services/promptAbV2Api';
import {
  loadLocalPromptAbV2Tests,
  mergePromptAbV2History,
  persistPromptAbV2Experiment,
} from '../utils/promptAbV2Storage';
import { PromptAbV2QueuePanel } from './PromptAbV2QueuePanel';
import { PromptAbV2RunDetail } from './PromptAbV2RunDetail';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export function PromptAbV2Dashboard() {
  const { job, running, startTest } = usePromptAbV2Run();
  const [history, setHistory] = useState<PromptAbV2Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(PROMPT_AB_V2_SYMBOLS[0]!);
  const [estimate, setEstimate] = useState<PromptAbV2CostEstimate | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const selected = useMemo(
    () => history.find(r => r.id === selectedId) ?? history[0] ?? null,
    [history, selectedId]
  );

  const previous = useMemo(() => {
    if (!selected) return null;
    const idx = history.findIndex(r => r.id === selected.id);
    return idx >= 0 ? history[idx + 1] ?? null : null;
  }, [history, selected]);

  const logRows: EvalLogRow[] = useMemo(
    () =>
      history.map((r, i) => ({
        id: r.id,
        completedAt: r.completedAt,
        label: `Run ${history.length - i}`,
        detail: `${r.symbols.length} sym · ${r.promptIds.length} prompts · ${r.tiers.length} tiers`,
        metric: r.costEval ? formatUsd(r.costEval.actualCostUsd) : '—',
      })),
    [history]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSyncNote(null);
    try {
      const { records, synced } = await loadEvalWithSync({
        loadLocal: loadLocalPromptAbV2Tests,
        getId: r => r.id,
        fetchServer: () => promptAbV2Api.getHistory(),
        syncToServer: records => promptAbV2Api.syncLocal(records),
        persistLocal: persistPromptAbV2Experiment,
        merge: (api, local) => mergePromptAbV2History(api, local),
      });
      setHistory(records);
      if (synced > 0) setSyncNote(`Synced ${synced} local v2 A/B run(s) to server.`);
      setSelectedId(prev => {
        if (prev && records.some(r => r.id === prev)) return prev;
        return records[0]?.id ?? null;
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not load Agent v2 A/B history'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void promptAbV2Api.getEstimate().then(setEstimate).catch(() => setEstimate(null));
  }, [load]);

  useEffect(() => {
    if (job?.status === 'completed' && job.experiment) {
      persistPromptAbV2Experiment(job.experiment);
      void load();
    }
  }, [job?.status, job?.experiment, load]);

  const handleStart = async () => {
    setError(null);
    try {
      await startTest();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start eval');
    }
  };

  const totalCells =
    PROMPT_AB_V2_SYMBOLS.length * PROMPT_AB_V2_PROMPT_IDS.length * AI_COST_TIERS.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-violet-600" />
            Agent v2 Prompt A/B
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Compares {PROMPT_AB_V2_PROMPT_IDS.length} hybrid prompt formulas × {AI_COST_TIERS.length}{' '}
            model tiers × {PROMPT_AB_V2_SYMBOLS.length} symbols ({totalCells} LLM cells). Each prompt
            blends deterministic scoring with a temporal logic chain; results include 7-day scenario
            paths and run-to-run deltas in the log.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-60"
          >
            <Play className="w-4 h-4" />
            {running ? 'Running…' : 'Run hybrid eval'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}
      {syncNote && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
          {syncNote}
        </p>
      )}

      {(running || job) && <PromptAbV2QueuePanel job={job} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Matrix size" value={`${totalCells} cells`} />
        <SummaryCard
          label="Est. cost"
          value={estimate ? formatUsd(estimate.estimatedCostUsd) : '—'}
        />
        <SummaryCard label="Runs logged" value={String(history.length)} />
        <SummaryCard
          label="Prompt variants"
          value={String(PROMPT_AB_V2_PROMPT_IDS.length)}
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Prompt formulas in this eval</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PROMPT_AB_V2_PROMPT_IDS.map(pid => (
            <div key={pid} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <p className="font-semibold text-slate-800">{PROMPT_AB_V2_PROMPT_LABELS[pid]}</p>
              <p className="text-slate-500 mt-0.5 font-mono">{pid}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[minmax(0,280px)_1fr] gap-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Run log</h3>
          <EvalRunLogTable
            rows={logRows}
            selectedId={selectedId}
            onSelect={setSelectedId}
            emptyMessage="No Agent v2 A/B runs yet. Start a hybrid eval to populate the log."
          />
        </div>
        <div>
          {selected ? (
            <PromptAbV2RunDetail
              record={selected}
              previousRecord={previous}
              selectedSymbol={selectedSymbol}
              onSymbolChange={setSelectedSymbol}
            />
          ) : (
            <p className="text-sm text-slate-500 py-12 text-center border border-dashed border-slate-200 rounded-xl">
              Select a run or start a new hybrid eval.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
