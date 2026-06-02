import type { PromptAbEngineeringInsight } from '@investai/shared';

interface PromptAbInsightPanelProps {
  insight?: PromptAbEngineeringInsight;
}

export function PromptAbInsightPanel({ insight }: PromptAbInsightPanelProps) {
  if (!insight) {
    return (
      <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 p-3">
        No AI insight for this run (OpenRouter may be unavailable or insight step failed).
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-violet-100">
        <h3 className="font-semibold text-violet-950">AI prompt engineering insight</h3>
        <p className="text-xs text-violet-800 mt-1">
          {insight.modelId} · {new Date(insight.generatedAt).toLocaleString()}
          {insight.tokensUsed != null ? ` · ${insight.tokensUsed} tokens` : ''}
        </p>
      </div>
      <div className="px-4 py-3 space-y-3 text-sm text-violet-950">
        <p>{insight.summary}</p>
        {insight.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-violet-900 uppercase tracking-wide">
              Recommendations
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-sm">
              {insight.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {insight.promptTweaks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-violet-900 uppercase tracking-wide">
              Suggested prompt tweaks
            </p>
            <ul className="list-disc pl-5 mt-1 space-y-1 text-sm font-mono text-violet-900">
              {insight.promptTweaks.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
