import type { PromptCatalogEntry, QuoteScrapeContext, ResolvedPrompt } from '../types.js';

const V2026_05_16: PromptCatalogEntry = {
  id: 'quote-scrape',
  version: '2026-05-16',
  label: 'Quote scrape v1 (baseline)',
  summary: 'JSON quotes with optional reasoning; realistic US OHLC.',
  changelog: 'Initial production prompt — no RAG or golden blocks in system text.',
  supportsRag: true,
  supportsGoldenHint: true,
};

const V2026_05_19: PromptCatalogEntry = {
  id: 'quote-scrape',
  version: '2026-05-19',
  label: 'Quote scrape v1 (production)',
  summary: 'Explicit Yahoo EOD alignment, RAG grounding, version-aware reasoning.',
  changelog:
    'Adds prompt-version field in JSON, stronger golden/RAG instructions for eval iteration.',
  supportsRag: true,
  supportsGoldenHint: true,
};

/** A/B-only v2 — not used on the main dashboard (see PROMPT_LATEST). */
const V2026_05_20: PromptCatalogEntry = {
  id: 'quote-scrape',
  version: '2026-05-20',
  label: 'Quote scrape v2 (A/B — live-cache anchor)',
  summary:
    'Anchors price to live-mode cached EOD; reports per-symbol deviation from ground truth in reasoning.',
  changelog:
    'Stricter live-cache alignment for prompt A/B tab; compares against Live dashboard bulk, not production default.',
  supportsRag: true,
  supportsGoldenHint: true,
};

const V2026_05_21: PromptCatalogEntry = {
  id: 'quote-scrape',
  version: '2026-05-21',
  label: 'Quote scrape v3 (web EOD)',
  summary: 'Requires public web sources and golden EOD alignment for latest quote.',
  changelog: 'Same web-scrape discipline as chart-scrape v3 for spot quotes.',
  supportsRag: true,
  supportsGoldenHint: true,
};

export const QUOTE_SCRAPE_CATALOG: PromptCatalogEntry[] = [
  V2026_05_16,
  V2026_05_19,
  V2026_05_20,
  V2026_05_21,
];

const WEB_SOURCES =
  'Yahoo Finance quote page, Google Finance, Nasdaq.com, or the company investor relations site';

function buildQuoteV1(ctx: QuoteScrapeContext): ResolvedPrompt {
  const goldenBlock = ctx.goldenHint?.trim()
    ? `\nGolden reference (Yahoo EOD — prefer last session close):\n${ctx.goldenHint}`
    : '';
  const ragBlock = ctx.ragContext?.trim() ? `\n${ctx.ragContext}` : '';
  return {
    id: 'quote-scrape',
    version: '2026-05-16',
    system: `You are a financial data extraction agent. Extract the latest available stock quote data for the requested symbols.
Respond ONLY with valid JSON in this shape:
{"reasoning":"One short paragraph: how you aligned prices to golden reference and context.","quotes":[{"symbol":"AAPL","name":"Apple Inc.","price":178.5,"change":1.2,"changePercent":0.68,"high":180,"low":176,"open":177,"previousClose":177.3,"volume":"45M","sector":"Technology"}]}
Use realistic recent US market prices. Include all numeric OHLC fields. volume as a string like "12.3M".`,
    user: `Extract current stock quotes for: ${ctx.symbols.join(', ')}.
Return one object per symbol in the quotes array.${goldenBlock}${ragBlock}`,
  };
}

function buildQuoteV2(ctx: QuoteScrapeContext): ResolvedPrompt {
  const goldenBlock = ctx.goldenHint?.trim()
    ? `\nGolden reference (Yahoo EOD — last session close is authoritative for price and previousClose):\n${ctx.goldenHint}`
    : '';
  const ragBlock = ctx.ragContext?.trim() ? `\n${ctx.ragContext}` : '';
  return {
    id: 'quote-scrape',
    version: '2026-05-19',
    system: `You are a financial data extraction agent (prompt suite 2026-05-19).
Respond ONLY with minified JSON:
{"promptVersion":"2026-05-19","reasoning":"How you used RAG context and golden Yahoo EOD (if any).","quotes":[{"symbol":"AAPL","name":"Apple Inc.","price":178.5,"change":1.2,"changePercent":0.68,"high":180,"low":176,"open":177,"previousClose":177.3,"volume":"45M","sector":"Technology"}]}
Rules: US equities; numeric OHLC; volume like "12.3M". When golden EOD is provided, price and previousClose must match within 0.5%. Use RAG only for names/sectors — not for inventing prices.`,
    user: `Extract current stock quotes for: ${ctx.symbols.join(', ')}.
Return one object per symbol. Echo promptVersion "2026-05-19" in the JSON root.${goldenBlock}${ragBlock}`,
  };
}

function buildQuoteV2Ab(ctx: QuoteScrapeContext): ResolvedPrompt {
  const goldenBlock = ctx.goldenHint?.trim()
    ? `\nGround truth (Live mode cached EOD — price and previousClose must match within 0.25%):\n${ctx.goldenHint}`
    : '';
  const ragBlock = ctx.ragContext?.trim() ? `\n${ctx.ragContext}` : '';
  return {
    id: 'quote-scrape',
    version: '2026-05-20',
    system: `You are a financial data extraction agent (prompt suite 2026-05-20 — A/B eval only).
Respond ONLY with minified JSON:
{"promptVersion":"2026-05-20","reasoning":"Per symbol: cite ground-truth close, your price, and abs deviation %.","quotes":[{"symbol":"AAPL","name":"Apple Inc.","price":178.5,"change":1.2,"changePercent":0.68,"high":180,"low":176,"open":177,"previousClose":177.3,"volume":"45M","sector":"Technology"}]}
Rules: US equities; numeric OHLC; volume like "12.3M". Ground-truth EOD is authoritative — do not invent prices. Use RAG only for names/sectors.`,
    user: `Extract stock quotes for: ${ctx.symbols.join(', ')}.
Echo promptVersion "2026-05-20". In reasoning, list each symbol's deviation from ground truth in percent.${goldenBlock}${ragBlock}`,
  };
}

function buildQuoteV3(ctx: QuoteScrapeContext): ResolvedPrompt {
  const goldenBlock = ctx.goldenHint?.trim()
    ? `\nGolden reference (Live/Yahoo last session EOD — price and previousClose must match within 1.5%):\n${ctx.goldenHint}`
    : '';
  const ragBlock = ctx.ragContext?.trim() ? `\n${ctx.ragContext}` : '';
  return {
    id: 'quote-scrape',
    version: '2026-05-21',
    system: `You are a financial data extraction agent (quote-scrape 2026-05-21).
Obtain REAL latest EOD quotes from public web pages (${WEB_SOURCES}) — not from memory.

Respond ONLY with minified JSON:
{"promptVersion":"2026-05-21","reasoning":"Per symbol: site used, EOD close read, deviation from golden if any","sources":["https://..."],"quotes":[{"symbol":"AAPL","name":"Apple Inc.","price":178.5,"change":1.2,"changePercent":0.68,"high":180,"low":176,"open":177,"previousClose":177.3,"volume":"45M","sector":"Technology"}]}
Rules: US equities; numeric OHLC; https sources required; do not invent prices; RAG only for names/sectors.`,
    user: `Extract current EOD stock quotes for: ${ctx.symbols.join(', ')}.
Echo promptVersion "2026-05-21". Include sources URLs.${goldenBlock}${ragBlock}`,
  };
}

export function resolveQuoteScrape(version: string, ctx: QuoteScrapeContext): ResolvedPrompt {
  if (version === '2026-05-21') return buildQuoteV3(ctx);
  if (version === '2026-05-20') return buildQuoteV2Ab(ctx);
  if (version === '2026-05-19') return buildQuoteV2(ctx);
  return buildQuoteV1(ctx);
}
