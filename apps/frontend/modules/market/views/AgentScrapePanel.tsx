import { useCallback, useEffect, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Play, Database, Radio } from 'lucide-react';
import type { QuoteDataMode } from '@investai/shared';
import type { AiCostTier, PromptEvalCooldownStatus, TierEstimate } from '@investai/shared';
import { AI_COST_TIERS } from '@investai/shared';
import { formatUsd } from '../../ai-estimate/utils/formatUsd';
import { useAuth } from '../../auth/controllers/AuthProvider';
import { useMarketData } from '../controllers/MarketDataProvider';
import { usageLimitsApi } from '../services/usageLimitsApi';
import { AgentCacheStatusBadge } from './AgentCacheStatusBadge';
import { agentUsageSummary } from '../utils/agentUsageLabel';
import { UsageLimitCooldownBanner } from './eval/UsageLimitCooldownBanner';

function formatTokens(n: number): string {
  return n.toLocaleString();
}

function shortModelId(modelId: string): string {
  const parts = modelId.split('/');
  return parts.length > 1 ? parts.slice(-2).join('/') : modelId;
}

interface TierCardProps {
  tier: TierEstimate;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function TierCard({ tier, selected, onSelect, disabled }: TierCardProps) {
  const strengthDots = '●'.repeat(tier.model.strengthRank) + '○'.repeat(3 - tier.model.strengthRank);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`text-left rounded-lg border p-3 transition-colors w-full disabled:opacity-50 ${
        selected
          ? 'border-violet-500 bg-white ring-2 ring-violet-400'
          : 'border-violet-200 bg-violet-50/50 hover:border-violet-300'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-violet-900">{tier.label}</span>
        <span className="text-xs text-violet-600">{strengthDots}</span>
      </div>
      <p className="mt-1 text-xs text-violet-700 truncate">{shortModelId(tier.model.modelId)}</p>
      <p className="mt-2 text-sm font-semibold text-violet-900">{formatUsd(tier.estimatedCostUsd)}</p>
      <p className="text-xs text-violet-700">~{formatTokens(tier.estimatedTokens.total)} tokens</p>
    </button>
  );
}

export function AgentScrapePanel() {
  const { loginAvailable, authenticated, requestLogin } = useAuth();
  const {
    agentEstimate,
    agentScrapeUsage,
    agentPendingConfirm,
    agentEstimateLoading,
    agentScraping,
    agentPanelExpanded,
    setAgentPanelExpanded,
    selectedAgentTier,
    setSelectedAgentTier,
    startAgentScrape,
    loadFromAgentCache,
    requestAgentEstimate,
    quoteDataMode,
    setQuoteDataMode,
    switchingMode,
    error,
    errorCode,
  } = useMarketData();

  const [localExpanded, setLocalExpanded] = useState(agentPanelExpanded);
  const [agentRunLimit, setAgentRunLimit] = useState<PromptEvalCooldownStatus | null>(null);
  const refreshAgentRunLimit = useCallback(async () => {
    try {
      const limits = await usageLimitsApi.getAll();
      setAgentRunLimit(limits.agentRun);
    } catch {
      setAgentRunLimit(null);
    }
  }, []);

  useEffect(() => {
    if (agentPendingConfirm) {
      setLocalExpanded(true);
      setAgentPanelExpanded(true);
    }
  }, [agentPendingConfirm, setAgentPanelExpanded]);

  useEffect(() => {
    if (localExpanded || agentPanelExpanded) {
      void refreshAgentRunLimit();
    }
  }, [localExpanded, agentPanelExpanded, refreshAgentRunLimit, authenticated]);

  const expanded = localExpanded || agentPanelExpanded;
  const agentRunBlocked = agentRunLimit != null && !agentRunLimit.allowed;

  const toggleExpanded = () => {
    const next = !expanded;
    setLocalExpanded(next);
    setAgentPanelExpanded(next);
  };

  const handleStart = async () => {
    await startAgentScrape(true);
    await refreshAgentRunLimit();
  };

  const estimate = agentEstimate;
  const cache = estimate?.cache;
  const tierByKey = estimate?.tiers.reduce(
    (acc, t) => {
      acc[t.tier] = t;
      return acc;
    },
    {} as Partial<Record<AiCostTier, TierEstimate>>
  );
  const selectedEstimate = tierByKey?.[selectedAgentTier];
  const canLoadCache =
    cache &&
    (cache.state === 'ready_fresh' ||
      cache.state === 'ready_aging' ||
      cache.chartsFullyCached === true ||
      cache.quotesFullyCached);

  const summaryLabel = cache?.label ?? 'Agent mode';
  const busy = agentScraping || agentEstimateLoading;

  if (agentEstimateLoading && !estimate) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-800 mb-4">
        Loading agent status…
      </div>
    );
  }

  if (!estimate || !cache) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4 space-y-2">
        <p className="font-medium">Agent mode — ready to configure</p>
        <p>
          {error ??
            'Could not load cost estimate. Confirm the backend is running and OPENROUTER_API_KEY is set in .env.'}
        </p>
        {errorCode && <p className="text-xs font-mono text-amber-800">{errorCode}</p>}
        <button
          type="button"
          onClick={() => void requestAgentEstimate()}
          disabled={agentEstimateLoading}
          className="text-sm font-medium text-amber-950 underline hover:no-underline disabled:opacity-50"
        >
          {agentEstimateLoading ? 'Retrying…' : 'Retry estimate'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 mb-4 overflow-hidden">
        <button
          type="button"
          onClick={toggleExpanded}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-violet-100/80"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-violet-600" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-violet-600" />
          )}
          <Bot className="w-4 h-4 shrink-0 text-violet-600" />
          <span className="font-medium text-violet-900 flex-1 truncate">{summaryLabel}</span>
          <span className="text-xs text-violet-600 shrink-0">
            {expanded ? 'Collapse' : 'Expand to start'}
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-violet-200 pt-3">
            <UsageLimitCooldownBanner
              status={agentRunLimit}
              scopeLabel="agent runs"
              onSignIn={
                loginAvailable && !authenticated ? () => requestLogin() : undefined
              }
            />

            {agentScrapeUsage && !agentScraping && (
              <div className="rounded-md border border-violet-300 bg-white/80 px-3 py-2 text-xs text-violet-900">
                <p>
                  Dashboard is using the last agent run · {agentUsageSummary(agentScrapeUsage)}
                  {agentScrapeUsage.modelId ? ` · ${shortModelId(agentScrapeUsage.modelId)}` : ''}
                </p>
                <p className="mt-1 text-violet-700">
                  Costs below are for chart-only LLM scrape (quotes from Live/Mock).
                </p>
              </div>
            )}
            <AgentCacheStatusBadge cache={cache} />

            <div>
              <p className="text-xs font-medium text-violet-800">Quote & news source</p>
              <div
                className="inline-flex gap-1 p-0.5 rounded-md border border-violet-300 bg-white/70 mb-3"
                role="group"
                aria-label="Agent quote source"
              >
                {(['live', 'mock'] as QuoteDataMode[]).map(q => (
                  <button
                    key={q}
                    type="button"
                    disabled={busy || switchingMode}
                    onClick={() => void setQuoteDataMode(q)}
                    className={`px-2.5 py-1 rounded text-xs font-medium ${
                      quoteDataMode === q
                        ? 'bg-violet-600 text-white'
                        : 'text-violet-800 hover:bg-violet-100'
                    } disabled:opacity-50`}
                  >
                    {q === 'live' ? (
                      <span className="inline-flex items-center gap-1">
                        <Radio className="w-3 h-3" />
                        Live
                      </span>
                    ) : (
                      'Mock'
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs font-medium text-violet-800 mb-2">Cost tier</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {AI_COST_TIERS.map(tierKey => {
                  const t = tierByKey?.[tierKey];
                  if (!t) return null;
                  return (
                    <TierCard
                      key={tierKey}
                      tier={t}
                      selected={selectedAgentTier === tierKey}
                      onSelect={() => setSelectedAgentTier(tierKey)}
                      disabled={busy}
                    />
                  );
                })}
              </div>
            </div>

            <p className="text-sm text-violet-900">
              <span className="font-medium">30-day LLM charts</span>
              <span className="block text-xs text-violet-700 mt-0.5">
                One OpenRouter call per symbol for OHLC history. Spot prices come from your Live/Mock
                quote source. See Agent run history after the job.
              </span>
            </p>

            {selectedEstimate && (
              <p className="text-xs text-violet-700">
                {selectedEstimate.label} — ~{formatTokens(selectedEstimate.estimatedTokens.total)}{' '}
                tokens, {formatUsd(selectedEstimate.estimatedCostUsd)}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={busy || !selectedEstimate || agentRunBlocked}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {agentScraping ? 'Starting…' : 'Start'}
                {selectedEstimate && !agentScraping && (
                  <span className="opacity-90">({formatUsd(selectedEstimate.estimatedCostUsd)})</span>
                )}
              </button>
              {canLoadCache && (
                <button
                  type="button"
                  onClick={() => loadFromAgentCache()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-violet-300 text-violet-800 text-sm font-medium hover:bg-violet-100 disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  Load cached
                </button>
              )}
            </div>
            <p className="text-xs text-violet-600">
              Start runs in the background — use the floating queue (bottom-right) to track progress.
              Live runs: 1h anonymous · 15m + 5/day signed in.
            </p>
          </div>
        )}
    </div>
  );
}
