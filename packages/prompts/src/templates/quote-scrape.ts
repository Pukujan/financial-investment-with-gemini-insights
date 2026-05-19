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
  label: 'Quote scrape v2 (RAG + golden)',
  summary: 'Explicit Yahoo EOD alignment, RAG grounding, version-aware reasoning.',
  changelog:
    'Adds prompt-version field in JSON, stronger golden/RAG instructions for eval iteration.',
  supportsRag: true,
  supportsGoldenHint: true,
};

export const QUOTE_SCRAPE_CATALOG: PromptCatalogEntry[] = [V2026_05_16, V2026_05_19];

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

export function resolveQuoteScrape(version: string, ctx: QuoteScrapeContext): ResolvedPrompt {
  if (version === '2026-05-19') return buildQuoteV2(ctx);
  return buildQuoteV1(ctx);
}
