import { AGENT_CHART_TRADING_DAYS } from '@investai/shared';
import type { ChartScrapeContext, PromptCatalogEntry, ResolvedPrompt } from '../types.js';

const V2026_05_16: PromptCatalogEntry = {
  id: 'chart-scrape',
  version: '2026-05-16',
  label: 'Chart scrape v1 (baseline)',
  summary: '30 trading-day OHLC bars as compact JSON arrays.',
  changelog: 'Calendar-aligned bars with optional anchor price in user prompt.',
  supportsRag: false,
  supportsGoldenHint: false,
};

const V2026_05_19: PromptCatalogEntry = {
  id: 'chart-scrape',
  version: '2026-05-19',
  label: 'Chart scrape v2 (RAG context)',
  summary: 'Same bar schema; optional catalog/news grounding per symbol.',
  changelog: 'Injects RAG snippets for sector/name consistency across the 30-day window.',
  supportsRag: true,
  supportsGoldenHint: false,
};

const V2026_05_21: PromptCatalogEntry = {
  id: 'chart-scrape',
  version: '2026-05-21',
  label: 'Chart scrape v3 (web EOD scrape)',
  summary:
    'Requires public web sources, per-day session closes, source URLs, and golden-anchor alignment.',
  changelog:
    'Instructs model to pull historical EOD from Yahoo/Google/Nasdaq pages; strict JSON + attestation fields.',
  supportsRag: true,
  supportsGoldenHint: true,
};

export const CHART_SCRAPE_CATALOG: PromptCatalogEntry[] = [
  V2026_05_16,
  V2026_05_19,
  V2026_05_21,
];

const WEB_SOURCES =
  'Yahoo Finance historical, Google Finance, Nasdaq.com quote/history, or the issuer investor relations daily prices page';

function buildChartV1(ctx: ChartScrapeContext): ResolvedPrompt {
  const anchor =
    ctx.anchorPrice != null && Number.isFinite(ctx.anchorPrice)
      ? ` Last close near $${ctx.anchorPrice.toFixed(2)}.`
      : '';
  const dateList = ctx.tradingDayKeys.join(', ');
  return {
    id: 'chart-scrape',
    version: '2026-05-16',
    system: `You are a financial data agent. Return ONLY minified JSON (no markdown, no prose):
{"symbol":"SYM","bars":[["YYYY-MM-DD",open,high,low,close],...]}
Exactly ${AGENT_CHART_TRADING_DAYS} daily bars, oldest to newest. OHLC must be numbers.`,
    user: `Generate daily OHLC for ${ctx.symbol} on exactly these US equity session dates (oldest to newest): ${dateList}. Use each date as YYYY-MM-DD in the bars array.${anchor}`,
  };
}

function buildChartV2(ctx: ChartScrapeContext): ResolvedPrompt {
  const base = buildChartV1(ctx);
  const ragBlock = ctx.ragContext?.trim() ? `\n${ctx.ragContext}` : '';
  return {
    ...base,
    version: '2026-05-19',
    system: `${base.system}
When context is provided, keep sector/name consistent; do not contradict the anchor close.`,
    user: `${base.user}${ragBlock}`,
  };
}

function buildChartV3(ctx: ChartScrapeContext): ResolvedPrompt {
  const sym = ctx.symbol.toUpperCase();
  const dateList = ctx.tradingDayKeys.join(', ');
  const goldenBlock = ctx.goldenHint?.trim()
    ? `\nGolden reference (last session EOD close from our Live cache — your final bar close must match within 1.5%):\n${ctx.goldenHint}`
    : '';
  const anchor =
    ctx.anchorPrice != null && Number.isFinite(ctx.anchorPrice)
      ? `\nAnchor close: $${ctx.anchorPrice.toFixed(2)} (use as sanity check for the newest session).`
      : '';
  const ragBlock = ctx.ragContext?.trim() ? `\nCompany context (names/sectors only — never copy prices from here):\n${ctx.ragContext}` : '';

  return {
    id: 'chart-scrape',
    version: '2026-05-21',
    system: `You are a financial data extraction agent (chart-scrape 2026-05-21).
Your job is to obtain REAL end-of-day (EOD) OHLC for US equities from public web pages — not from memory.

Allowed sources (use at least one per symbol): ${WEB_SOURCES}.

Respond ONLY with minified JSON (no markdown):
{"promptVersion":"2026-05-21","symbol":"SYM","sources":["https://..."],"dataAttestation":"1–2 sentences: which site(s) you used and how you read the daily close column","bars":[["YYYY-MM-DD",open,high,low,close],...]}

Hard rules:
- Exactly ${AGENT_CHART_TRADING_DAYS} bars, oldest→newest, one bar per listed session date.
- Each bar date MUST be one of the provided session dates (YYYY-MM-DD).
- close = official session EOD close from the source (adjusted close OK if that is what the site shows).
- open/high/low must be plausible for that session (low ≤ min(open,close) ≤ high).
- Do NOT invent prices, interpolate missing days, or smooth curves.
- sources must be https URLs you actually relied on (finance.yahoo.com, google.com/finance, nasdaq.com, etc.).
- If you cannot find a date on the web, omit that bar and set dataAttestation to explain — never guess.
- When golden reference is provided, the newest bar close must be within 1.5% of that value.`,
    user: `Symbol: ${sym}
Session dates (oldest to newest — use EXACTLY these ${AGENT_CHART_TRADING_DAYS} keys): ${dateList}
Task: Scrape/download historical daily OHLC for ${sym} from ${WEB_SOURCES} for each date above.
Echo promptVersion "2026-05-21".${anchor}${goldenBlock}${ragBlock}`,
  };
}

export function resolveChartScrape(version: string, ctx: ChartScrapeContext): ResolvedPrompt {
  if (version === '2026-05-21') return buildChartV3(ctx);
  if (version === '2026-05-19') return buildChartV2(ctx);
  return buildChartV1(ctx);
}
