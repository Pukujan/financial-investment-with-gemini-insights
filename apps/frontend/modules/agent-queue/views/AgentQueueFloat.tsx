import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Loader2,
  Minus,
} from 'lucide-react';
import type { AgentScrapeJob } from '@investai/shared';
import { useMarketData } from '../../market/controllers/MarketDataProvider';
import { usePromptEvalRun } from '../../market/controllers/PromptEvalRunProvider';
import { useDraggablePanel } from '../hooks/useDraggablePanel';
import {
  clearAgentQueuePrefs,
  loadAgentQueuePrefs,
  saveAgentQueuePrefs,
} from '../utils/agentQueueStorage';
import { agentJobStatusLabel } from '../utils/jobStatusLabel';
import { AgentScrapeFloatEmpty, AgentScrapeFloatPanel } from './AgentScrapeFloatPanel';
import { PromptEvalFloatPanel } from './PromptEvalFloatPanel';

const PANEL_W = 352;
const PANEL_H_MIN = 140;
const PANEL_H_EXPANDED = 340;
const PANEL_H_PROMPT_EVAL = 440;
const PANEL_H_WITH_EVAL = 400;

export function AgentQueueFloat() {
  const { promptEvalJob, promptEvalRunning, clearPromptEvalJob } = usePromptEvalRun();
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
    navigateToChartEval,
  } = useMarketData();

  const [prefs, setPrefs] = useState(loadAgentQueuePrefs);
  const [minimized, setMinimized] = useState(prefs.minimized);
  const [stepsExpanded, setStepsExpanded] = useState(prefs.stepsExpanded);
  const displayJob = agentJob ?? prefs.lastJob;
  const displayStatus: AgentScrapeJob['status'] | 'idle' = displayJob?.status ?? 'idle';
  const showPromptEval = promptEvalJob != null;
  const terminal =
    displayJob != null &&
    ['completed', 'failed', 'cancelled', 'timed_out'].includes(displayJob.status);
  const showCompleteGuide =
    scrapeCompleteGuide && displayJob?.status === 'completed' && !agentScraping;
  const hasEvalSummary =
    terminal && Boolean(displayJob?.estimateEval || displayJob?.chartEval);

  const pct =
    displayJob && displayJob.progress.total > 0
      ? Math.round((displayJob.progress.completed / displayJob.progress.total) * 100)
      : 0;

  const panelHeight = minimized
    ? 48
    : showPromptEval
      ? PANEL_H_PROMPT_EVAL
      : stepsExpanded && displayJob
        ? hasEvalSummary
          ? PANEL_H_WITH_EVAL
          : PANEL_H_EXPANDED
        : terminal && hasEvalSummary
          ? PANEL_H_WITH_EVAL
          : PANEL_H_MIN;

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

  useEffect(() => {
    if (promptEvalRunning) setMinimized(false);
  }, [promptEvalRunning]);

  const handleReset = useCallback(() => {
    if (showPromptEval) {
      clearPromptEvalJob();
    } else {
      clearAgentJobHistory();
      dismissScrapeCompleteGuide();
    }
    clearAgentQueuePrefs();
    const next = loadAgentQueuePrefs();
    setPrefs(next);
    setMinimized(false);
  }, [
    clearAgentJobHistory,
    clearPromptEvalJob,
    dismissScrapeCompleteGuide,
    showPromptEval,
  ]);

  const canReset =
    (showPromptEval && promptEvalJob && !promptEvalRunning) ||
    (!showPromptEval && displayJob != null && terminal && !agentScraping);

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
        aria-label="Agent queue"
      >
        <span
          className="cursor-grab active:cursor-grabbing p-0.5"
          onPointerDown={handlePointerDown}
        >
          <GripHorizontal className="w-4 h-4 text-violet-300" />
        </span>
        <button type="button" onClick={() => setMinimized(false)} className="flex items-center gap-2">
          <Bot className="w-4 h-4" />
          <span>{showPromptEval ? '30-day eval' : agentJobStatusLabel(displayStatus)}</span>
          {(promptEvalRunning || agentScraping) && <Loader2 className="w-4 h-4 animate-spin" />}
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
      className="fixed z-[100] rounded-xl border border-violet-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[min(90vh,560px)]"
      role="dialog"
      aria-label="Agent queue"
    >
      <div
        onPointerDown={handlePointerDown}
        className="flex items-center gap-1.5 px-2 py-2 bg-violet-600 text-white cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <GripHorizontal className="w-4 h-4 shrink-0 text-violet-300" />
        <Bot className="w-4 h-4 shrink-0" />
        <span className="font-medium text-sm flex-1 truncate">
          {showPromptEval ? '30-day eval' : 'Agent queue'}
        </span>
        <span className="text-xs text-violet-200 shrink-0">
          {showPromptEval
            ? promptEvalJob?.status === 'running' || promptEvalJob?.status === 'queued'
              ? 'Running'
              : (promptEvalJob?.status ?? '—')
            : agentJobStatusLabel(displayStatus)}
        </span>
        {(promptEvalRunning || agentScraping) && (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-violet-200" />
        )}
        {displayJob && !showPromptEval && (
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
        {canReset && (
          <button
            type="button"
            onClick={handleReset}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded hover:bg-violet-500 shrink-0"
            aria-label="Reset queue panel"
          >
            Reset
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

      {showPromptEval && promptEvalJob && <PromptEvalFloatPanel job={promptEvalJob} />}

      {!showPromptEval && !displayJob && (
        <AgentScrapeFloatEmpty
          dataMode={dataMode}
          onSetDataModeAgent={() => void setDataMode('agent')}
        />
      )}

      {!showPromptEval && displayJob && (
        <AgentScrapeFloatPanel
          job={displayJob}
          pct={pct}
          agentScraping={agentScraping}
          dataMode={dataMode}
          stepsExpanded={stepsExpanded}
          showCompleteGuide={showCompleteGuide}
          onCancel={() => void cancelAgentScrape()}
          onReset={handleReset}
          onNavigateToDataSources={navigateToDataSources}
          onNavigateToEstimateEval={navigateToEstimateEval}
          onNavigateToChartEval={navigateToChartEval}
          onNavigateToDashboard={navigateToDashboard}
          onDismissGuide={dismissScrapeCompleteGuide}
        />
      )}

      {showPromptEval && promptEvalJob && !promptEvalRunning && (
        <div className="px-3 py-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-violet-700 hover:text-violet-900 px-2 py-1 rounded border border-violet-200 hover:bg-violet-50"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use AgentQueueFloat */
export const AgentScrapeQueueFloat = AgentQueueFloat;
