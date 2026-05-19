import type { AgentScrapeJob } from '@investai/shared';
import { agentUsageSummary } from '../../market/utils/agentUsageLabel';
import { AgentJobStepIcon } from '../components/AgentJobStepIcon';
import { AgentJobEvalSummary } from './AgentJobEvalSummary';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'timed_out']);

interface AgentScrapeFloatPanelProps {
  job: AgentScrapeJob;
  pct: number;
  agentScraping: boolean;
  stepsExpanded: boolean;
  showCompleteGuide: boolean;
  onCancel: () => void;
  onReset: () => void;
  onNavigateToDataSources: () => void;
  onNavigateToEstimateEval: () => void;
  onNavigateToChartEval: () => void;
  onNavigateToDashboard: () => void;
  onDismissGuide: () => void;
}

export function AgentScrapeFloatPanel({
  job,
  pct,
  agentScraping,
  stepsExpanded,
  showCompleteGuide,
  onCancel,
  onReset,
  onNavigateToDataSources,
  onNavigateToEstimateEval,
  onNavigateToChartEval,
  onNavigateToDashboard,
  onDismissGuide,
}: AgentScrapeFloatPanelProps) {
  const terminal = TERMINAL_STATUSES.has(job.status);
  const hasEval = Boolean(job.estimateEval || job.chartEval);

  return (
    <>
      <div className="px-3 py-2 bg-violet-50 border-b border-violet-100">
        <div className="h-1.5 rounded-full bg-violet-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              job.status === 'failed' || job.status === 'timed_out'
                ? 'bg-red-500'
                : job.status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-violet-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-violet-800 mt-1">
          {job.progress.completed}/{job.progress.total} steps · {pct}%
        </p>
      </div>

      {terminal && hasEval && <AgentJobEvalSummary job={job} />}

      {showCompleteGuide && (
        <div className="px-3 py-2.5 bg-emerald-50 border-b border-emerald-100 space-y-2">
          <p className="text-xs text-emerald-900 font-medium">Scrape complete</p>
          <p className="text-xs text-emerald-800">
            Quotes are AI-generated via OpenRouter, not exchange data. Review where your data comes
            from before using it.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onNavigateToDataSources}
              className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Agent data sources
            </button>
            {job.estimateEval && (
              <button
                type="button"
                onClick={onNavigateToEstimateEval}
                className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              >
                View estimate eval
              </button>
            )}
            {job.chartEval && (
              <button
                type="button"
                onClick={onNavigateToChartEval}
                className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              >
                View run history
              </button>
            )}
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
            >
              View scraped stocks
            </button>
            <button
              type="button"
              onClick={onDismissGuide}
              className="text-xs text-emerald-700 hover:text-emerald-900 underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {stepsExpanded && job.steps.length > 0 && (
        <ul className="max-h-40 overflow-y-auto px-2 py-2 space-y-1 text-xs">
          {job.steps.map(step => (
            <li
              key={step.id}
              className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50"
            >
              <AgentJobStepIcon status={step.status} />
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

      <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap items-center gap-2 mt-auto">
        {job.usage && (
          <span className="text-xs text-slate-600 truncate flex-1 min-w-[8rem]">
            {agentUsageSummary(job.usage)}
          </span>
        )}
        {agentScraping && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-red-600 hover:text-red-800 font-medium"
          >
            Cancel
          </button>
        )}
        {terminal && job.error && (
          <p className="text-xs text-amber-700 truncate flex-1">{job.error}</p>
        )}
        {terminal && !agentScraping && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-xs font-medium text-violet-700 hover:text-violet-900 px-2 py-1 rounded border border-violet-200 hover:bg-violet-50"
          >
            Reset
          </button>
        )}
      </div>
    </>
  );
}

interface AgentScrapeFloatEmptyProps {
  dataMode: string;
  onSetDataModeAgent: () => void;
}

export function AgentScrapeFloatEmpty({ dataMode, onSetDataModeAgent }: AgentScrapeFloatEmptyProps) {
  return (
    <div className="px-3 py-3 text-xs text-slate-600 space-y-2">
      <p>No scrape yet. Open Agent mode and press Start.</p>
      {dataMode !== 'agent' && (
        <button
          type="button"
          onClick={onSetDataModeAgent}
          className="text-violet-700 font-medium underline hover:text-violet-900"
        >
          Switch to Agent mode
        </button>
      )}
    </div>
  );
}
