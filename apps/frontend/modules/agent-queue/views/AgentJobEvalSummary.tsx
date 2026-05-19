import type { AgentScrapeJob, EstimateAccuracyRating } from '@investai/shared';

const ACCURACY_COPY: Record<EstimateAccuracyRating, string> = {
  excellent: 'Actual tokens within 10% of pre-scrape estimate.',
  good: 'Actual tokens within 25% of estimate.',
  fair: 'Actual tokens within 50% of estimate.',
  poor: 'Actual tokens diverged more than 50% from estimate.',
  cached: 'Served from cache — no new OpenRouter tokens.',
  unknown: 'Could not compare to estimate.',
};

function formatPct(p: number | null | undefined): string {
  if (p == null) return '—';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

interface AgentJobEvalSummaryProps {
  job: AgentScrapeJob;
}

export function AgentJobEvalSummary({ job }: AgentJobEvalSummaryProps) {
  const estimate = job.estimateEval;
  const chart = job.chartEval;

  if (!estimate && !chart) return null;

  return (
    <div className="px-3 py-2 border-b border-violet-100 bg-slate-50/90 space-y-2">
      <p className="text-xs font-medium text-violet-900">Run eval</p>

      {estimate && (
        <div className="rounded-md border border-violet-100 bg-white px-2 py-1.5 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-violet-800">Token estimate</span>
            <span className="text-[10px] uppercase tracking-wide text-violet-600">
              {estimate.accuracy}
            </span>
          </div>
          <p className="text-[10px] leading-snug text-slate-700">{ACCURACY_COPY[estimate.accuracy]}</p>
          <p className="text-[10px] text-slate-600">
            {estimate.actual.tokens.total.toLocaleString()} actual vs{' '}
            {estimate.estimate.estimatedTokens.total.toLocaleString()} estimated (
            {formatPct(estimate.tokenDeltaPercent)})
          </p>
          {estimate.costDeltaPercent != null && !estimate.fromCache && (
            <p className="text-[10px] text-slate-500">
              Cost delta {formatPct(estimate.costDeltaPercent)} vs estimate
            </p>
          )}
        </div>
      )}

      {chart && (
        <div className="rounded-md border border-violet-100 bg-white px-2 py-1.5 space-y-1">
          <span className="text-[10px] font-medium text-violet-800">Chart alignment</span>
          <p className="text-[10px] leading-snug text-slate-700">
            {chart.scrapeCharts
              ? 'LLM 30-day OHLC vs quote anchor and Yahoo EOD reference.'
              : 'Synthetic series from quotes (no LLM chart scrape on this run).'}
          </p>
          {chart.summary.avgAbsQuoteVsLlmPct != null && (
            <p className="text-[10px] text-slate-600">
              Avg |quote − LLM last close|: {chart.summary.avgAbsQuoteVsLlmPct.toFixed(2)}%
            </p>
          )}
          {chart.summary.avgAbsLiveDeviationPct != null && chart.liveReference === 'yahoo' && (
            <p className="text-[10px] text-slate-600">
              Avg |agent − Yahoo| per day: {chart.summary.avgAbsLiveDeviationPct.toFixed(2)}% across{' '}
              {chart.summary.symbolCount} symbols
            </p>
          )}
          {chart.liveReference !== 'yahoo' && chart.scrapeCharts && (
            <p className="text-[10px] text-slate-500">Yahoo reference not fetched for this run.</p>
          )}
        </div>
      )}
    </div>
  );
}
