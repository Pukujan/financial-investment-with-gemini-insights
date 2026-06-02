/** Chart-scrape response contract — enforced in backend after LLM parse. */
export const CHART_SCRAPE_BAR_COUNT = 30;

/** Minimum aligned session closes before accepting a scrape (allows 1–2 missing holidays). */
export const CHART_SCRAPE_MIN_ALIGNED_BARS = 28;

/** v2026-05-21+ — last bar close vs golden anchor (percent). */
export const CHART_SCRAPE_MAX_ANCHOR_DEVIATION_PCT = 1.5;

/** Mean |close − live| / live across aligned days (percent) — contract warning threshold. */
export const CHART_SCRAPE_MAX_MEAN_DAILY_DEVIATION_PCT = 8;

/** v2026-05-21 requires at least one http(s) source URL per symbol response. */
export const CHART_SCRAPE_V21 = '2026-05-21' as const;

export const CHART_SCRAPE_V16 = '2026-05-16' as const;

export function chartScrapeRequiresSourceUrls(version: string): boolean {
  return version >= CHART_SCRAPE_V21;
}
