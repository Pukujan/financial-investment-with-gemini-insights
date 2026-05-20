import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitCompare, Play, RefreshCw } from 'lucide-react';
import type {
  AiCostTier,
  PromptAbTestExperiment,
  PromptAbTestSummary,
  PromptEvalCooldownStatus,
} from '@investai/shared';
import {
  AI_COST_TIER_LABELS,
  AI_COST_TIERS,
  PROMPT_AB_VERSION_A_DEFAULT,
  PROMPT_AB_VERSION_B_DEFAULT,
  PROMPT_EVAL_WINDOW_DAYS,
} from '@investai/shared';
import { promptAbApi } from '../services/promptAbApi';
import {
  loadLocalPromptAbTests,
  mergePromptAbHistory,
  persistPromptAbExperiment,
} from '../utils/promptAbStorage';
import { loadEvalWithSync } from '../utils/evalStorageSync';
import { useAuth } from '../../auth/controllers/AuthProvider';
import { usePromptAbRun } from '../controllers/PromptAbRunProvider';
import { useMarketData } from '../controllers/MarketDataProvider';
import { EvalRunTimeline, type EvalTimelineItem } from './eval/EvalRunTimeline';
import { EvalRunLogTable, type EvalLogRow } from './eval/EvalRunLogTable';
import { PromptAbRunDetail } from './eval/PromptAbRunDetail';
import { UsageLimitCooldownBanner } from './eval/UsageLimitCooldownBanner';
import { isMarketStockBundleFresh, loadMarketStockBundle } from '../utils/marketStockStorage';
import { formatUsd } from '../../ai-estimate/utils/formatUsd';
import { ApiError } from '../../../shared/api/http';
import type { PromptAbCostEstimateSnapshot } from '@investai/shared';

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

export function PromptAbDashboard() {
  const { dataMode } = useMarketData();
  const { loginAvailable, authenticated, requestLogin } = useAuth();
  const { startPromptAbTest, promptAbJob, promptAbRunning } = usePromptAbRun();
  const [history, setHistory] = useState<{ records: PromptAbTestExperiment[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [versionA, setVersionA] = useState(PROMPT_AB_VERSION_A_DEFAULT);
  const [versionB, setVersionB] = useState(PROMPT_AB_VERSION_B_DEFAULT);
  const [tier, setTier] = useState<AiCostTier>('cheaper');
  const [ragEnabled, setRagEnabled] = useState(false);
  const [catalog, setCatalog] = useState<Array<{ version: string; label: string }>>([]);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<PromptAbTestSummary | null>(null);
  const [cooldown, setCooldown] = useState<PromptEvalCooldownStatus | null>(null);
  const [preEstimate, setPreEstimate] = useState<PromptAbCostEstimateSnapshot | null>(null);

  const liveCacheFresh = useMemo(() => {
    const bundle = loadMarketStockBundle({ dataMode: 'live' });
    return bundle != null && isMarketStockBundleFresh(bundle);
  }, [dataMode]);

  const refreshCooldown = useCallback(async () => {
    try {
      setCooldown(await promptAbApi.getCooldown());
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
        loadLocal: loadLocalPromptAbTests,
        getId: r => r.id,
        fetchServer: () => promptAbApi.getHistory(),
        syncToServer: records => promptAbApi.syncLocal(records),
        persistLocal: persistPromptAbExperiment,
        merge: (api, local) => mergePromptAbHistory(api, local),
      });
      setHistory({ records });
      if (synced > 0) setSyncNote(`Synced ${synced} local A/B run(s) to server.`);
      setSelectedId(prev => {
        if (prev && records.some(r => r.id === prev)) return prev;
        return records[0]?.id ?? null;
      });
    } catch (err) {
      const missingRoutes =
        err instanceof ApiError &&
        err.status === 404 &&
        (err.code === 'API_INVALID_JSON' || /Cannot GET/i.test(err.message));
      setError(
        missingRoutes
          ? 'Backend API is missing Prompt A/B routes (stale Railway deploy). Redeploy the backend service from latest main, then confirm GET /api/health includes gitCommitSha starting with 29b7fb9.'
          : err instanceof Error
            ? err.message
            : 'Could not load A/B history'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void refreshCooldown();
    void promptAbApi
      .getPromptCatalog()
      .then(res => {
        const quote = res.catalog.filter(e => e.id === 'quote-scrape');
        setCatalog(quote.map(e => ({ version: e.version, label: e.label })));
      })
      .catch(() => setCatalog([]));
  }, [load, refreshCooldown]);

  useEffect(() => {
    void promptAbApi
      .getEstimate({ tier, ragEnabled, symbolLimit: 3 })
      .then(setPreEstimate)
      .catch(() => setPreEstimate(null));
  }, [tier, ragEnabled]);

  const records = history?.records ?? [];
  const selected = useMemo(
    () => records.find(r => r.id === selectedId) ?? records[0] ?? null,
    [records, selectedId]
  );

  const logRows: EvalLogRow[] = useMemo(
    () =>
      records.map(r => ({
        id: r.id,
        completedAt: r.completedAt,
        label: `${r.resolvedVersionA} vs ${r.resolvedVersionB}`,
        detail: `Winner ${r.winner.overall} · ${r.efficiency?.moreEfficientArm ?? '—'} eff`,
        metric: r.costEval
          ? `${formatUsd(r.costEval.actual.costUsd)} · A ${r.armA.avgAbsQuoteDeviationPct.toFixed(1)}%`
          : `A ${r.armA.avgAbsQuoteDeviationPct.toFixed(1)}% · B ${r.armB.avgAbsQuoteDeviationPct.toFixed(1)}%`,
      })),
    [records]
  );

  const timelineItems: EvalTimelineItem[] = useMemo(
    () =>
      records.map(r => ({
        id: r.id,
        completedAt: r.completedAt,
        title: `${r.resolvedVersionA} vs ${r.resolvedVersionB}`,
        subtitle: r.headline,
        badge:
          r.winner.overall === 'tie'
            ? 'Tie'
            : `Win ${r.winner.overall}`,
        badgeClassName:
          r.winner.overall === 'B'
            ? 'bg-emerald-100 text-emerald-800'
            : r.winner.overall === 'A'
              ? 'bg-indigo-100 text-indigo-800'
              : 'bg-slate-100 text-slate-600',
      })),
    [records]
  );

  const runTest = async () => {
    setError(null);
    setLastSummary(null);
    try {
      await startPromptAbTest({ versionA, versionB, tier, ragEnabled });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A/B test failed');
    }
  };

  useEffect(() => {
    if (!promptAbRunning || !promptAbJob) return;
    if (promptAbJob.status === 'completed' && promptAbJob.experiment) {
      persistPromptAbExperiment(promptAbJob.experiment);
      if (promptAbJob.summary) setLastSummary(promptAbJob.summary);
      setSelectedId(promptAbJob.experiment.id);
      void load();
      void refreshCooldown();
    }
    if (promptAbJob.status === 'failed') {
      setError(promptAbJob.error ?? 'A/B test failed');
    }
  }, [promptAbJob, promptAbRunning, load, refreshCooldown]);

  const cooldownBlocked = cooldown != null && !cooldown.allowed;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="w-7 h-7 text-emerald-600" />
            <h2 className="text-2xl font-semibold text-slate-900">Prompt A/B test</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Compare two <strong>quote-scrape</strong> prompt versions side-by-side against{' '}
            <strong>Live mode cached EOD</strong> (same ground truth as the prompt eval tab).{' '}
            <strong>v2 ({PROMPT_AB_VERSION_B_DEFAULT})</strong> is not used on the main dashboard — production stays on{' '}
            {PROMPT_AB_VERSION_A_DEFAULT}.
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

      {!liveCacheFresh && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Switch to <strong>Live</strong> mode and refresh stocks first so ground truth comes from your cached Live bulk
          (within 12h). Without it, the server falls back to Yahoo per symbol.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Prompt A (production)
          <select
            value={versionA}
            onChange={e => setVersionA(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 min-w-[200px]"
          >
            {catalog.length > 0 ? (
              catalog.map(c => (
                <option key={c.version} value={c.version}>
                  {c.label}
                </option>
              ))
            ) : (
              <option value={versionA}>{versionA}</option>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          Prompt B (v2 experimental)
          <select
            value={versionB}
            onChange={e => setVersionB(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 min-w-[200px]"
          >
            {catalog.length > 0 ? (
              catalog.map(c => (
                <option key={c.version} value={c.version}>
                  {c.label}
                </option>
              ))
            ) : (
              <option value={versionB}>{versionB}</option>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          LLM tier (both arms)
          <select
            value={tier}
            onChange={e => setTier(e.target.value as AiCostTier)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5"
          >
            {AI_COST_TIERS.map(t => (
              <option key={t} value={t}>
                {AI_COST_TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={ragEnabled}
            onChange={e => setRagEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          RAG (both arms)
        </label>
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={promptAbRunning || cooldownBlocked || versionA === versionB}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Play className="w-4 h-4" />
          {promptAbRunning ? 'Running A/B…' : 'Run A/B test'}
        </button>
        <p className="text-xs text-slate-500 w-full">
          {PROMPT_EVAL_WINDOW_DAYS}-day EOD comparison · one tier · shared ground truth snapshot · uses prompt-test cooldown.
        </p>
      </div>

      <UsageLimitCooldownBanner
        status={cooldown}
        scopeLabel="prompt A/B tests"
        onSignIn={loginAvailable && !authenticated ? () => requestLogin() : undefined}
      />

      {promptAbRunning && promptAbJob && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <p className="font-medium">{promptAbJob.phaseLabel}</p>
          <p className="text-xs mt-1">
            Step {promptAbJob.progress.completed}/{promptAbJob.progress.total}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {promptAbJob.steps.map(s => (
              <li key={s.id}>
                {s.label}: <strong>{s.status}</strong>
                {s.detail ? ` — ${s.detail}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {preEstimate && !promptAbRunning && (
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="text-xs font-medium text-slate-600">Pre-run estimate (both arms)</p>
          <p className="mt-1">
            ~{preEstimate.estimatedTokens.total.toLocaleString()} tokens ·{' '}
            {formatUsd(preEstimate.estimatedCostUsd)} · {preEstimate.symbolCount} symbols
          </p>
        </section>
      )}

      {lastSummary && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium text-emerald-900">Latest A/B result</p>
          <p className="text-sm text-emerald-950 mt-1 font-medium">{lastSummary.headline}</p>
          {lastSummary.actualCostUsd != null && (
            <p className="text-xs text-emerald-800 mt-1">
              Cost {formatUsd(lastSummary.actualCostUsd)} (est {formatUsd(lastSummary.estimatedCostUsd)}
              {lastSummary.costDeltaPercent != null &&
                ` · ${lastSummary.costDeltaPercent > 0 ? '+' : ''}${lastSummary.costDeltaPercent.toFixed(1)}%`}
              ) · more efficient: {lastSummary.moreEfficientArm}
            </p>
          )}
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

      {loading && !history && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && records.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          No A/B runs yet. Run a test to compare prompt versions against Live cached ground truth.
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Arm A quote dev" value={`${selected.armA.avgAbsQuoteDeviationPct.toFixed(2)}%`} />
          <SummaryCard label="Arm B quote dev" value={`${selected.armB.avgAbsQuoteDeviationPct.toFixed(2)}%`} />
          <SummaryCard label="Winner" value={selected.winner.overall} />
          <SummaryCard
            label="Cost (actual)"
            value={
              selected.costEval ? formatUsd(selected.costEval.actual.costUsd) : '—'
            }
          />
        </div>
      )}

      {records.length > 0 && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6">
          <div className="space-y-4">
            <EvalRunTimeline
              items={timelineItems}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <EvalRunLogTable rows={logRows} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          {selected ? <PromptAbRunDetail record={selected} /> : null}
        </div>
      )}
    </div>
  );
}
