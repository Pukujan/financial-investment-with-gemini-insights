import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  GripHorizontal,
  Loader2,
  Minus,
  X,
  XCircle,
  SkipForward,
} from 'lucide-react';
import type { AgentJobStepStatus, AgentScrapeJob } from '@investai/shared';
import { agentUsageSummary } from '../utils/agentUsageLabel';
import { useMarketData } from '../controllers/MarketDataProvider';
import { useDraggablePanel } from '../hooks/useDraggablePanel';
import { loadAgentQueuePrefs, saveAgentQueuePrefs } from '../utils/agentQueueStorage';

const PANEL_W = 352;
const PANEL_H_MIN = 140;
const PANEL_H_EXPANDED = 300;

function StepIcon({ status }: { status: AgentJobStepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />;
    case 'done':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-600" />;
    case 'skipped':
      return <SkipForward className="w-3.5 h-3.5 text-slate-400" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-slate-300" />;
  }
}

function statusLabel(status: AgentScrapeJob['status'] | 'idle'): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'timed_out':
      return 'Timed out';
  }
}

export function AgentScrapeQueueFloat() {
  const {
    agentJob,
    agentScraping,
    dataMode,
    cancelAgentScrape,
    clearAgentJobHistory,
    setDataMode,
    scrapeCompleteGuide,
    dismissScrapeCompleteGuide,
    navigateToDataSources,
    navigateToDashboard,
    navigateToEstimateEval,
  } = useMarketData();

  const [prefs, setPrefs] = useState(loadAgentQueuePrefs);
  const [minimized, setMinimized] = useState(prefs.minimized);
  const [stepsExpanded, setStepsExpanded] = useState(prefs.stepsExpanded);
  const displayJob = agentJob ?? prefs.lastJob;
  const displayStatus: AgentScrapeJob['status'] | 'idle' = displayJob?.status ?? 'idle';
  const terminal =
    displayJob != null &&
    ['completed', 'failed', 'cancelled', 'timed_out'].includes(displayJob.status);
  const showCompleteGuide =
    scrapeCompleteGuide && displayJob?.status === 'completed' && !agentScraping;

  const pct =
    displayJob && displayJob.progress.total > 0
      ? Math.round((displayJob.progress.completed / displayJob.progress.total) * 100)
      : 0;

  const panelHeight = minimized ? 48 : stepsExpanded && displayJob ? PANEL_H_EXPANDED : PANEL_H_MIN;

  const onPositionChange = useCallback((pos: { x: number; y: number }) => {
    saveAgentQueuePrefs({ position: pos });
    setPrefs(prev => ({ ...prev, position: pos }));
  }, []);

  const { position, handlePointerDown } = useDraggablePanel({
    initialPosition: prefs.position,
    onPositionChange,
    panelWidth: minimized ? 220 : PANEL_W,
    panelHeight,
  });

  useEffect(() => {
    saveAgentQueuePrefs({ minimized, stepsExpanded });
  }, [minimized, stepsExpanded]);

  useEffect(() => {
    if (agentJob) {
      setPrefs(prev => ({ ...prev, lastJob: agentJob, lastJobId: agentJob.id }));
    }
  }, [agentJob]);

  const posStyle: React.CSSProperties = {
    left: position.x,
    top: position.y,
    width: minimized ? 'auto' : PANEL_W,
    maxWidth: 'min(calc(100vw - 16px), 22rem)',
  };

  if (minimized) {
    return (
      <div
        style={posStyle}
        className="fixed z-[100] flex items-center gap-2 rounded-full bg-violet-600 text-white pl-2 pr-4 py-2.5 shadow-lg text-sm font-medium select-none touch-none"
        role="dialog"
        aria-label="Agent scrape queue"
      >
        <span
          className="cursor-grab active:cursor-grabbing p-0.5"
          onPointerDown={handlePointerDown}
        >
          <GripHorizontal className="w-4 h-4 text-violet-300" />
        </span>
        <button type="button" onClick={() => setMinimized(false)} className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          <span>{statusLabel(displayStatus)}</span>
          {agentScraping && <Loader2 className="w-4 h-4 animate-spin" />}
          {displayJob && displayJob.progress.total > 0 && (
            <span className="text-violet-200">{pct}%</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      style={posStyle}
      className="fixed z-[100] rounded-xl border border-violet-200 bg-white shadow-2xl overflow-hidden flex flex-col"
      role="dialog"
      aria-label="Agent scrape queue"
    >
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center gap-1.5 px-2 py-2 bg-violet-600 text-white cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <GripHorizontal className="w-4 h-4 shrink-0 text-violet-300" />
        <Bot className="w-4 h-4 shrink-0" />
        <span className="font-medium text-sm flex-1 truncate">Agent queue</span>
        <span className="text-xs text-violet-200 shrink-0">{statusLabel(displayStatus)}</span>
        {displayJob && (
          <button
            type="button"
            onClick={() => setStepsExpanded(e => !e)}
            className="p-1 hover:bg-violet-500 rounded shrink-0"
            aria-label={stepsExpanded ? 'Collapse steps' : 'Expand steps'}
          >
            {stepsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="p-1 hover:bg-violet-500 rounded shrink-0"
          aria-label="Minimize to pill"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {!displayJob ? (
        <div className="px-3 py-3 text-xs text-slate-600 space-y-2">
          <p>No scrape yet. Open Agent mode and press Start.</p>
          {dataMode !== 'agent' && (
            <button
              type="button"
              onClick={() => void setDataMode('agent')}
              className="text-violet-700 font-medium underline hover:text-violet-900"
            >
              Switch to Agent mode
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="px-3 py-2 bg-violet-50 border-b border-violet-100">
            <div className="h-1.5 rounded-full bg-violet-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  displayJob.status === 'failed' || displayJob.status === 'timed_out'
                    ? 'bg-red-500'
                    : displayJob.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-violet-600'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-violet-800 mt-1">
              {displayJob.progress.completed}/{displayJob.progress.total} steps · {pct}%
            </p>
          </div>

          {showCompleteGuide && (
            <div className="px-3 py-2.5 bg-emerald-50 border-b border-emerald-100 space-y-2">
              <p className="text-xs text-emerald-900 font-medium">Scrape complete</p>
              <p className="text-xs text-emerald-800">
                Quotes are AI-generated via OpenRouter, not exchange data. Review where your data
                comes from before using it.
              </p>
              {displayJob.estimateEval && (
                <p className="text-xs text-emerald-800">
                  Tokens: {displayJob.estimateEval.actual.tokens.total.toLocaleString()} actual vs{' '}
                  {displayJob.estimateEval.estimate.estimatedTokens.total.toLocaleString()}{' '}
                  estimated (
                  {displayJob.estimateEval.tokenDeltaPercent != null
                    ? `${displayJob.estimateEval.tokenDeltaPercent >= 0 ? '+' : ''}${displayJob.estimateEval.tokenDeltaPercent.toFixed(1)}%`
                    : 'cached'}
                  ).
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={navigateToDataSources}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Agent data sources
                </button>
                {displayJob.estimateEval && (
                  <button
                    type="button"
                    onClick={navigateToEstimateEval}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  >
                    View estimate eval
                  </button>
                )}
                <button
                  type="button"
                  onClick={navigateToDashboard}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                >
                  View scraped stocks
                </button>
                <button
                  type="button"
                  onClick={dismissScrapeCompleteGuide}
                  className="text-xs text-emerald-700 hover:text-emerald-900 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {stepsExpanded && displayJob.steps.length > 0 && (
            <ul className="max-h-40 overflow-y-auto px-2 py-2 space-y-1 text-xs">
              {displayJob.steps.map(step => (
                <li
                  key={step.id}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50"
                >
                  <StepIcon status={step.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800 truncate">{step.label}</p>
                    {step.error && <p className="text-red-600 truncate">{step.error}</p>}
                    {step.tokensUsed != null && step.tokensUsed > 0 && (
                      <p className="text-slate-500">{step.tokensUsed.toLocaleString()} tokens</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-2 mt-auto">
            {displayJob.usage && (
              <span className="text-xs text-slate-600 truncate">
                {agentUsageSummary(displayJob.usage)}
              </span>
            )}
            {agentScraping && (
              <button
                type="button"
                onClick={() => cancelAgentScrape()}
                className="ml-auto text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Cancel
              </button>
            )}
            {terminal && displayJob.error && (
              <p className="text-xs text-amber-700 truncate flex-1">{displayJob.error}</p>
            )}
            {terminal && !agentScraping && (
              <button
                type="button"
                onClick={clearAgentJobHistory}
                className="ml-auto p-1 text-slate-500 hover:text-slate-800 shrink-0"
                aria-label="Clear job history"
                title="Clear job from queue"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
