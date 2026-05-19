import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, Play, RefreshCw } from 'lucide-react';
import type {
  PromptEvalCooldownStatus,
  PromptEvalExperiment,
  PromptEvalTestSummary,
} from '@investai/shared';
import { AI_COST_TIER_LABELS, PROMPT_EVAL_WINDOW_DAYS } from '@investai/shared';
import { promptEvalApi } from '../services/promptEvalApi';
import {
  loadLocalPromptEvals,
  mergePromptEvalHistory,
  persistPromptEvalExperiment,
} from '../utils/promptEvalStorage';
import { loadEvalWithSync } from '../utils/evalStorageSync';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useAuth } from '../../auth/controllers/AuthProvider';
import { usePromptEvalRun } from '../controllers/PromptEvalRunProvider';
import { EvalRunTimeline, type EvalTimelineItem } from './eval/EvalRunTimeline';
import { EvalRunLogTable, type EvalLogRow } from './eval/EvalRunLogTable';
import { PromptEvalRunDetail } from './eval/PromptEvalRunDetail';
import { UsageLimitCooldownBanner } from './eval/UsageLimitCooldownBanner';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export function PromptEvalDashboard() {
  const { loginAvailable, authenticated, requestLogin } = useAuth();
  const { startPromptEvalTest, promptEvalJob } = usePromptEvalRun();
  const [history, setHistory] = useState<{ records: PromptEvalExperiment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [promptVersion, setPromptVersion] = useState(`v-${new Date().toISOString().slice(0, 10)}`);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<PromptEvalTestSummary | null>(null);
  const [cooldown, setCooldown] = useState<PromptEvalCooldownStatus | null>(null);

  const refreshCooldown = useCallback(async () => {
    try {
      setCooldown(await promptEvalApi.getCooldown());
    } catch {
      setCooldown(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSyncNote(null);
    try {
      const { records, synced } = await loadEvalWithSync({
        loadLocal: loadLocalPromptEvals,
        getId: r => r.id,
        fetchServer: () => promptEvalApi.getHistory(),
        syncToServer: records => promptEvalApi.syncLocal(records),
        persistLocal: persistPromptEvalExperiment,
        merge: (api, local) => mergePromptEvalHistory(api, local),
      });
      const merged = { records, lastRecord: records[0] ?? null };
      setHistory(merged);
      if (synced > 0) setSyncNote(`Synced ${synced} local run(s) to server + Firestore.`);
      setSelectedId(prev => {
        if (prev && merged.records.some(r => r.id === prev)) return prev;
        return merged.records[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load prompt eval history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void refreshCooldown();
  }, [load, refreshCooldown]);

  const records = history?.records ?? [];
  const selected: PromptEvalExperiment | null = useMemo(
    () => records.find(r => r.id === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  const logRows: EvalLogRow[] = useMemo(
    () =>
      records.map(r => {
        const best = [...r.tiers].sort(
          (a, b) => a.avgAbsQuoteDeviationPct - b.avgAbsQuoteDeviationPct
        )[0];
        return {
          id: r.id,
          completedAt: r.completedAt,
          label: r.promptVersion,
          detail: `3 tiers · ${r.symbols.length} symbols`,
          metric: best ? `${best.avgAbsQuoteDeviationPct.toFixed(1)}% best quote` : '—',
        };
      }),
    [records]
  );

  const timelineItems: EvalTimelineItem[] = useMemo(
    () =>
      records.map(r => {
        const best = [...r.tiers].sort(
          (a, b) => a.avgAbsQuoteDeviationPct - b.avgAbsQuoteDeviationPct
        )[0];
        const imp = r.improvement;
        const delta =
          imp.avgQuoteDeviationDeltaPct != null
            ? ` · Δ ${imp.avgQuoteDeviationDeltaPct > 0 ? '+' : ''}${imp.avgQuoteDeviationDeltaPct.toFixed(1)}%`
            : '';
        return {
          id: r.id,
          completedAt: r.completedAt,
          title: r.promptVersion,
          subtitle: `${r.symbols.length} symbols · best ${best ? (AI_COST_TIER_LABELS[best.tier] ?? best.tier) : '—'} ${best?.avgAbsQuoteDeviationPct.toFixed(1) ?? '—'}%${delta}`,
          badge: r.rag.enabled ? 'RAG on' : 'No RAG',
          badgeClassName: r.rag.enabled
            ? 'bg-violet-100 text-violet-800'
            : 'bg-slate-100 text-slate-600',
        };
      }),
    [records]
  );

  const runTest = async () => {
    setRunning(true);
    setError(null);
    setLastSummary(null);
    try {
      await startPromptEvalTest({
        promptVersion,
        ragEnabled,
        symbolLimit: 3,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!running || !promptEvalJob) return;
    if (promptEvalJob.status === 'completed' && promptEvalJob.experiment) {
      persistPromptEvalExperiment(promptEvalJob.experiment);
      if (promptEvalJob.summary) setLastSummary(promptEvalJob.summary);
      setSelectedId(promptEvalJob.experiment.id);
      void load();
      void refreshCooldown();
      setRunning(false);
    }
    if (promptEvalJob.status === 'failed') {
      setError(promptEvalJob.error ?? 'Test failed');
      setRunning(false);
    }
  }, [promptEvalJob, running, load, refreshCooldown]);

  const cooldownBlocked = cooldown != null && !cooldown.allowed;

  const bestTier = selected
    ? [...selected.tiers].sort((a, b) => a.avgAbsQuoteDeviationPct - b.avgAbsQuoteDeviationPct)[0]
    : null;

  const improvementSeries = useMemo(() => {
    return [...records]
      .reverse()
      .map(r => {
        const best = [...r.tiers].sort(
          (a, b) => a.avgAbsQuoteDeviationPct - b.avgAbsQuoteDeviationPct
        )[0];
        return {
          label: r.promptVersion.slice(0, 12),
          completedAt: new Date(r.completedAt).toLocaleDateString(),
          quoteDev: best?.avgAbsQuoteDeviationPct ?? 0,
          dailyDev: best?.avgAbsDailyDeviationPct ?? 0,
        };
      });
  }, [records]);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-violet-600" />
            <h2 className="text-2xl font-semibold text-slate-900">Eval prompt test</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Run controlled experiments: three LLM tiers scrape quotes with optional RAG context,
            compared to Yahoo EOD over <strong>{PROMPT_EVAL_WINDOW_DAYS} trading days</strong> (not a 1-day spot check).
            Full charts and logs appear in the timeline below.
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

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Prompt version
          <input
            type="text"
            value={promptVersion}
            onChange={e => setPromptVersion(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 min-w-[160px]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={ragEnabled}
            onChange={e => setRagEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Enable RAG retrieval
        </label>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={running || cooldownBlocked}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${running ? 'opacity-50' : ''}`} />
          {running ? 'Running 30-day test…' : 'Run 30-day test'}
        </button>
        <p className="text-xs text-slate-500 w-full">
          Runs in the background — track each LLM tier and reasoning in the floating queue (bottom-right).
          Cooldown: 1h anonymous · 15m signed-in (5/day max).
        </p>
      </div>

      <UsageLimitCooldownBanner
        status={cooldown}
        scopeLabel="prompt tests"
        onSignIn={loginAvailable && !authenticated ? () => requestLogin() : undefined}
      />

      {lastSummary && (
        <section className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-xs font-medium text-violet-900">Latest test summary (API)</p>
          <p className="text-sm text-violet-950 mt-1 font-medium">{lastSummary.headline}</p>
          <p className="text-xs text-violet-800 mt-1">
            {lastSummary.evalWindowDays}-day EOD · {lastSummary.symbolsTested} symbols · experiment{' '}
            <code className="text-[10px]">{lastSummary.experimentId.slice(0, 8)}…</code>
          </p>
        </section>
      )}

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

      {improvementSeries.length > 1 && (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-xs font-medium text-slate-700 mb-2">
            Improvement timeline — best-tier avg |quote − Yahoo| % per experiment
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={improvementSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="completedAt" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="quoteDev" name="Quote dev %" stroke="#7c3aed" strokeWidth={2} dot />
                <Line type="monotone" dataKey="dailyDev" name="Daily EOD dev %" stroke="#059669" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {loading && !history && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && records.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          No prompt eval runs yet. Run an experiment to compare three LLM tiers against Yahoo golden data.
        </div>
      )}

      {selected && bestTier && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Prompt" value={selected.promptVersion} />
          <SummaryCard
            label="Best tier (quote)"
            value={`${AI_COST_TIER_LABELS[bestTier.tier] ?? bestTier.tier} · ${bestTier.avgAbsQuoteDeviationPct.toFixed(2)}%`}
          />
          <SummaryCard label="RAG" value={selected.rag.enabled ? `${selected.rag.chunksRetrieved} chunks` : 'Off'} />
          {selected.improvement.avgQuoteDeviationDeltaPct != null && (
            <SummaryCard
              label="vs previous run"
              value={`${selected.improvement.avgQuoteDeviationDeltaPct > 0 ? '+' : ''}${selected.improvement.avgQuoteDeviationDeltaPct.toFixed(2)}%`}
            />
          )}
        </div>
      )}

      {records.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Run log</h3>
          <EvalRunLogTable
            rows={logRows}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        </section>
      )}

      {records.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,300px)_1fr] gap-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Experiment timeline</h3>
            <EvalRunTimeline
              items={timelineItems}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              emptyMessage="No experiments yet."
            />
          </section>
          <div className="min-w-0">
            {selected ? (
              <PromptEvalRunDetail record={selected} />
            ) : (
              <p className="text-sm text-slate-500">Select a run to view golden vs tier deviation.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
