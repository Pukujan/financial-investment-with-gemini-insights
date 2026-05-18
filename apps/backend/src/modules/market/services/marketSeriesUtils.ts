import type { TimeSeriesData } from '@investai/shared';

const CHART_DAYS = 30;

/** Uppercase symbol keys, sort ascending by date, keep last 30 points. */
export function normalizeSeriesBySymbol(
  series: Record<string, TimeSeriesData[]>
): Record<string, TimeSeriesData[]> {
  const out: Record<string, TimeSeriesData[]> = {};
  for (const [key, points] of Object.entries(series)) {
    if (!points?.length) continue;
    const sym = key.toUpperCase();
    const sorted = [...points].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    out[sym] = sorted.slice(-CHART_DAYS);
  }
  return out;
}
