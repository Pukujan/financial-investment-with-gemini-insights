import type { StockQuote } from '@investai/shared';
import { env } from '../../../../config/env.js';
import {
  callAiWithUsageFallback,
  parseJsonFromText,
  type TokenUsage,
} from '../../../../utils/aiClient.js';
import { normalizeAgentQuote } from '../normalizeAgentQuote.js';

const SYSTEM_PROMPT = `You are a financial data extraction agent. Extract the latest available stock quote data for the requested symbols.
Respond ONLY with valid JSON in this shape:
{"reasoning":"One short paragraph: how you aligned prices to golden reference and context.","quotes":[{"symbol":"AAPL","name":"Apple Inc.","price":178.5,"change":1.2,"changePercent":0.68,"high":180,"low":176,"open":177,"previousClose":177.3,"volume":"45M","sector":"Technology"}]}
Use realistic recent US market prices. Include all numeric OHLC fields. volume as a string like "12.3M".`;

export async function scrapeQuotesWithAgent(
  symbols: string[],
  model?: string,
  options?: { ragContext?: string; goldenHint?: string }
): Promise<{ quotes: StockQuote[]; usage: TokenUsage; model: string; reasoning?: string }> {
  const want = new Set(symbols.map(s => s.toUpperCase()));
  const goldenBlock = options?.goldenHint?.trim()
    ? `\nGolden reference (Yahoo EOD — prefer last session close):\n${options.goldenHint}`
    : '';
  const ragBlock = options?.ragContext?.trim() ? `\n${options.ragContext}` : '';
  const prompt = `Extract current stock quotes for: ${[...want].join(', ')}.
Return one object per symbol in the quotes array.${goldenBlock}${ragBlock}`;

  const { text, usage, model: usedModel } = await callAiWithUsageFallback(
    prompt,
    SYSTEM_PROMPT,
    4096,
    model,
    env.agentScrapeBatchTimeoutMs
  );
  const parsed = parseJsonFromText<{ quotes: Partial<StockQuote>[]; reasoning?: string }>(text);

  if (!Array.isArray(parsed.quotes)) {
    throw new Error('Agent response missing quotes array');
  }

  const quotes = parsed.quotes
    .map(q => {
      const sym = String(q.symbol ?? '')
        .trim()
        .toUpperCase()
        .replace(/^\$/, '');
      if (!sym || !want.has(sym)) return null;
      return normalizeAgentQuote(sym, q);
    })
    .filter((q): q is StockQuote => q !== null);

  const reasoning =
    typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
      ? parsed.reasoning.trim().slice(0, 600)
      : undefined;

  return { quotes, usage, model: usedModel, reasoning };
}
