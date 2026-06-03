import type { PromptAbV2Job } from '@investai/shared';
import { AI_COST_TIER_LABELS, PROMPT_AB_V2_PROMPT_LABELS } from '@investai/shared';

interface PromptAbV2QueuePanelProps {
  job: PromptAbV2Job | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  running: 'bg-amber-100 text-amber-800 animate-pulse',
  done: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
};

export function PromptAbV2QueuePanel({ job }: PromptAbV2QueuePanelProps) {
  if (!job) return null;

  const pct =
    job.progress.total > 0
      ? Math.round((job.progress.completed / job.progress.total) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-violet-900">Queue — Agent v2 hybrid eval</h3>
          <p className="text-xs text-violet-700 mt-0.5">{job.phaseLabel}</p>
        </div>
        <span className="text-xs font-medium text-violet-800 uppercase tracking-wide">
          {job.status}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs text-violet-700 mb-1">
          <span>
            {job.progress.completed} / {job.progress.total} cells
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-violet-200 overflow-hidden">
          <div
            className="h-full bg-violet-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {job.steps.map(step => (
          <div
            key={step.id}
            className={`rounded-lg px-2 py-1.5 text-xs ${STATUS_STYLE[step.status] ?? STATUS_STYLE.pending}`}
          >
            <span className="font-medium">{step.label}</span>
            {step.detail && <p className="truncate opacity-80">{step.detail}</p>}
          </div>
        ))}
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-violet-200 bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Symbol</th>
              <th className="px-2 py-1.5 text-left font-medium">Prompt</th>
              <th className="px-2 py-1.5 text-left font-medium">Model</th>
              <th className="px-2 py-1.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {job.queue.map(item => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-2 py-1 font-medium text-slate-800">{item.symbol}</td>
                <td className="px-2 py-1 text-slate-600">
                  {PROMPT_AB_V2_PROMPT_LABELS[item.promptId].split(' ')[0]}
                </td>
                <td className="px-2 py-1 text-slate-600">{AI_COST_TIER_LABELS[item.tier]}</td>
                <td className="px-2 py-1 text-right">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 ${STATUS_STYLE[item.status] ?? ''}`}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {job.error && (
        <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{job.error}</p>
      )}
    </div>
  );
}
