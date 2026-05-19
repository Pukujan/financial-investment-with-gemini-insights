import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { PromptEvalJob, PromptEvalJobTierStep, PromptEvalStepStatus } from '@investai/shared';

function StepIcon({ status }: { status: PromptEvalStepStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 animate-spin text-violet-600 shrink-0" />;
    case 'done':
      return <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />;
    case 'failed':
      return <XCircle className="w-3 h-3 text-red-600 shrink-0" />;
    default:
      return <Circle className="w-3 h-3 text-slate-300 shrink-0" />;
  }
}

function shortModel(modelId?: string): string {
  if (!modelId) return '';
  const parts = modelId.split('/');
  return parts.length > 1 ? parts.slice(-2).join('/') : modelId;
}

function TierCard({ tier }: { tier: PromptEvalJobTierStep }) {
  const barColor =
    tier.status === 'failed'
      ? 'bg-red-500'
      : tier.status === 'done'
        ? 'bg-emerald-500'
        : tier.status === 'running'
          ? 'bg-violet-600'
          : 'bg-slate-200';

  return (
    <div className="rounded-md border border-violet-100 bg-white/90 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <StepIcon status={tier.status} />
          <span className="text-xs font-medium text-violet-900 truncate">{tier.label}</span>
        </div>
        {tier.avgQuoteDeviationPct != null && tier.status === 'done' && (
          <span className="text-[10px] text-violet-700 shrink-0">
            {tier.avgQuoteDeviationPct.toFixed(1)}% vs Yahoo
          </span>
        )}
      </div>
      {tier.modelId && (
        <p className="text-[10px] text-slate-500 truncate">{shortModel(tier.modelId)}</p>
      )}
      <div className="h-1 rounded-full bg-violet-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${tier.progress}%` }}
        />
      </div>
      {(tier.reasoning || tier.error) && (
        <div
          className={`text-[10px] leading-snug max-h-20 overflow-y-auto rounded px-1.5 py-1 ${
            tier.error ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-700'
          }`}
        >
          {tier.error ?? tier.reasoning}
        </div>
      )}
      {tier.tokensUsed != null && tier.tokensUsed > 0 && tier.status === 'done' && (
        <p className="text-[10px] text-slate-500">{tier.tokensUsed.toLocaleString()} tokens</p>
      )}
    </div>
  );
}

interface PromptEvalFloatPanelProps {
  job: PromptEvalJob;
}

export function PromptEvalFloatPanel({ job }: PromptEvalFloatPanelProps) {
  const pct =
    job.progress.total > 0
      ? Math.round((job.progress.completed / job.progress.total) * 100)
      : 0;

  return (
    <div className="border-b border-violet-100 bg-violet-50/80 px-3 py-2 space-y-2 overflow-y-auto flex-1 min-h-0">
      <div>
        <p className="text-xs font-medium text-violet-900">30-day prompt test</p>
        <p className="text-[10px] text-violet-700 truncate">{job.phaseLabel}</p>
        <div className="h-1.5 rounded-full bg-violet-200 overflow-hidden mt-1.5">
          <div
            className={`h-full rounded-full transition-all ${
              job.status === 'failed'
                ? 'bg-red-500'
                : job.status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-violet-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-violet-600 mt-0.5">
          {job.progress.completed}/{job.progress.total} steps · {pct}%
        </p>
      </div>

      {job.setupSteps.length > 0 && (
        <ul className="space-y-0.5">
          {job.setupSteps.map(step => (
            <li key={step.id} className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <StepIcon status={step.status} />
              <span className="truncate">{step.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2">
        {job.tiers.map(tier => (
          <TierCard key={tier.tier} tier={tier} />
        ))}
      </div>

      {job.error && (
        <p className="text-[10px] text-red-700 bg-red-50 rounded px-2 py-1">{job.error}</p>
      )}
      {job.status === 'completed' && job.summary && (
        <p className="text-[10px] text-emerald-800 font-medium">{job.summary.headline}</p>
      )}
    </div>
  );
}
