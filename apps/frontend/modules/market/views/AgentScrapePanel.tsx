import { useEffect, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Play, Database } from 'lucide-react';
import type { AiCostTier, TierEstimate } from '@investai/shared';
import { AI_COST_TIERS } from '@investai/shared';
import { formatUsd } from '../../ai-estimate/utils/formatUsd';
import { useMarketData } from '../controllers/MarketDataProvider';
import { AgentCacheStatusBadge } from './AgentCacheStatusBadge';
import { agentUsageSummary } from '../utils/agentUsageLabel';

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
    scrapeCharts,
    setScrapeCharts,
    startAgentScrape,
    loadFromAgentCache,
    requestAgentEstimate,
    error,
    errorCode,
  } = useMarketData();

  const [localExpanded, setLocalExpanded] = useState(agentPanelExpanded);

  const expanded = localExpanded || agentPanelExpanded;

  useEffect(() => {
    if (agentPendingConfirm) {
      setLocalExpanded(true);
      setAgentPanelExpanded(true);
    }
  }, [agentPendingConfirm, setAgentPanelExpanded]);

  const toggleExpanded = () => {
    const next = !expanded;
    setLocalExpanded(next);
    setAgentPanelExpanded(next);
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
    (cache.state === 'ready_fresh' || cache.state === 'ready_aging' || cache.quotesFullyCached);

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
          {agentScrapeUsage && !agentScraping && (
            <div className="rounded-md border border-violet-300 bg-white/80 px-3 py-2 text-xs text-violet-900">
              <p>
                Dashboard is using the last agent run · {agentUsageSummary(agentScrapeUsage)}
                {agentScrapeUsage.modelId ? ` · ${shortModelId(agentScrapeUsage.modelId)}` : ''}
              </p>
              <p className="mt-1 text-violet-700">
                Costs below are for a new live scrape (cached batches are $0).
              </p>
            </div>
          )}
          <AgentCacheStatusBadge cache={cache} />

          <div>
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

          <label className="flex items-start gap-2 text-sm text-violet-900 cursor-pointer">
            <input
              type="checkbox"
              checked={scrapeCharts}
              onChange={e => {
                setScrapeCharts(e.target.checked);
                void requestAgentEstimate();
              }}
              disabled={busy}
              className="mt-1 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
            />
            <span>
              <span className="font-medium">Scrape 30-day charts</span>
              <span className="block text-xs text-violet-700 mt-0.5">
                Extra LLM calls for OHLC history (vs synthetic drift). See Chart eval after run.
              </span>
            </span>
          </label>

          {selectedEstimate && (
            <p className="text-xs text-violet-700">
              {selectedEstimate.label} — ~{formatTokens(selectedEstimate.estimatedTokens.total)}{' '}
              tokens, {formatUsd(selectedEstimate.estimatedCostUsd)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startAgentScrape(true)}
              disabled={busy || !selectedEstimate}
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
          </p>
        </div>
      )}
    </div>
  );
}
