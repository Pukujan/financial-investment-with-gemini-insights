import type { StockQuote } from '@investai/shared';
import { resolveQuotePrompt } from '@investai/prompts';
import { env } from '../../../../config/env.js';
import {
  callAiWithUsageFallback,
  parseJsonFromText,
  type TokenUsage,
} from '../../../../utils/aiClient.js';
import { normalizeAgentQuote } from '../normalizeAgentQuote.js';

export async function scrapeQuotesWithAgent(
  symbols: string[],
  model?: string,
  options?: {
    ragContext?: string;
    goldenHint?: string;
    promptVersion?: string;
  }
): Promise<{ quotes: StockQuote[]; usage: TokenUsage; model: string; reasoning?: string }> {
  const want = new Set(symbols.map(s => s.toUpperCase()));
  const { system, user } = resolveQuotePrompt(
    {
      symbols: [...want],
      goldenHint: options?.goldenHint,
      ragContext: options?.ragContext,
    },
    options?.promptVersion
  );

  const { text, usage, model: usedModel } = await callAiWithUsageFallback(
    user,
    system,
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
