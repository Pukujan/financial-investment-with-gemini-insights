import type { TimeSeriesData } from '@investai/shared';
import {
  CHART_SCRAPE_BAR_COUNT,
  CHART_SCRAPE_MAX_ANCHOR_DEVIATION_PCT,
  CHART_SCRAPE_MAX_MEAN_DAILY_DEVIATION_PCT,
  CHART_SCRAPE_MIN_ALIGNED_BARS,
  chartScrapeRequiresSourceUrls,
  pctDiff,
} from '@investai/shared';

export const CHART_CONTRACT_VIOLATION = 'CHART_CONTRACT_VIOLATION' as const;

export interface ChartScrapeContractInput {
  version: string;
  symbol: string;
  expectedDates: string[];
  anchorClose?: number;
  liveSeries?: TimeSeriesData[];
  sources?: string[];
  dataAttestation?: string;
}

export interface ChartScrapeContractResult {
  ok: boolean;
  code?: typeof CHART_CONTRACT_VIOLATION;
  violations: string[];
  alignedBarCount: number;
  meanDailyDeviationPct: number | null;
  anchorDeviationPct: number | null;
}

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function ohlcBarValid(open: number, high: number, low: number, close: number): boolean {
  if (![open, high, low, close].every(n => Number.isFinite(n) && n > 0)) return false;
  const lo = Math.min(open, close);
  const hi = Math.max(open, close);
  return low <= lo + 0.0001 && high >= hi - 0.0001;
}

export function assertChartScrapeContract(
  series: TimeSeriesData[],
  input: ChartScrapeContractInput
): ChartScrapeContractResult {
  const violations: string[] = [];
  const sym = input.symbol.toUpperCase();
  const expectedSet = new Set(input.expectedDates);

  if (chartScrapeRequiresSourceUrls(input.version)) {
    const urls = (input.sources ?? []).filter(s => s.trim().length > 0);
    if (urls.length === 0) {
      violations.push(`${sym}: missing sources[] https URLs (required for ${input.version})`);
    } else if (!urls.some(isHttpsUrl)) {
      violations.push(`${sym}: sources must include at least one valid http(s) URL`);
    }
    if (!input.dataAttestation?.trim()) {
      violations.push(`${sym}: missing dataAttestation (required for ${input.version})`);
    }
  }

  const byDate = new Map<string, TimeSeriesData>();
  for (const p of series) {
    const d = p.timestamp.split('T')[0]!;
    if (!expectedSet.has(d)) {
      violations.push(`${sym}: unexpected bar date ${d} (not in session calendar)`);
      continue;
    }
    if (byDate.has(d)) {
      violations.push(`${sym}: duplicate bar for ${d}`);
      continue;
    }
    if (!ohlcBarValid(p.open, p.high, p.low, p.close)) {
      violations.push(`${sym}: invalid OHLC on ${d}`);
    }
    byDate.set(d, p);
  }

  const alignedBarCount = input.expectedDates.filter(d => byDate.has(d)).length;
  if (alignedBarCount < CHART_SCRAPE_MIN_ALIGNED_BARS) {
    violations.push(
      `${sym}: only ${alignedBarCount}/${CHART_SCRAPE_BAR_COUNT} session dates present (min ${CHART_SCRAPE_MIN_ALIGNED_BARS})`
    );
  }

  let anchorDeviationPct: number | null = null;
  if (input.anchorClose != null && input.anchorClose > 0) {
    const lastDate = input.expectedDates[input.expectedDates.length - 1];
    const lastBar = lastDate ? byDate.get(lastDate) : undefined;
    if (lastBar) {
      anchorDeviationPct = Math.abs(pctDiff(lastBar.close, input.anchorClose));
      if (anchorDeviationPct > CHART_SCRAPE_MAX_ANCHOR_DEVIATION_PCT) {
        violations.push(
          `${sym}: last close deviates ${anchorDeviationPct.toFixed(2)}% from anchor (max ${CHART_SCRAPE_MAX_ANCHOR_DEVIATION_PCT}%)`
        );
      }
    }
  }

  let meanDailyDeviationPct: number | null = null;
  if (input.liveSeries?.length) {
    const liveByDate = new Map(
      input.liveSeries.map(p => [p.timestamp.split('T')[0]!, p.close])
    );
    const devs: number[] = [];
    for (const d of input.expectedDates) {
      const agent = byDate.get(d);
      const live = liveByDate.get(d);
      if (agent && live != null && live > 0) {
        devs.push(Math.abs(pctDiff(agent.close, live)));
      }
    }
    if (devs.length > 0) {
      meanDailyDeviationPct = devs.reduce((a, b) => a + b, 0) / devs.length;
      if (meanDailyDeviationPct > CHART_SCRAPE_MAX_MEAN_DAILY_DEVIATION_PCT) {
        violations.push(
          `${sym}: mean daily close deviation ${meanDailyDeviationPct.toFixed(2)}% exceeds ${CHART_SCRAPE_MAX_MEAN_DAILY_DEVIATION_PCT}%`
        );
      }
    }
  }

  return {
    ok: violations.length === 0,
    code: violations.length > 0 ? CHART_CONTRACT_VIOLATION : undefined,
    violations,
    alignedBarCount,
    meanDailyDeviationPct,
    anchorDeviationPct,
  };
}

export function formatChartContractError(result: ChartScrapeContractResult): string {
  return result.violations.join('; ');
}
