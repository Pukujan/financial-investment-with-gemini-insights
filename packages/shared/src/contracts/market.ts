import type { MarketDataMode, MarketProvider } from '../types.js';

/** Well-known provider ids — use these instead of string literals in new code. */
export const MARKET_PROVIDER = {
  YAHOO: 'yahoo',
  MOCK_CATALOG: 'mock-catalog',
  OPENROUTER_AGENT: 'openrouter-agent',
} as const satisfies Record<string, MarketProvider>;

/** Providers allowed for live quote/chart bulk fetch. */
export const LIVE_QUOTE_PROVIDERS = [MARKET_PROVIDER.YAHOO] as const;

export type LiveQuoteProvider = (typeof LIVE_QUOTE_PROVIDERS)[number];

export function isLiveQuoteProvider(provider: string): provider is LiveQuoteProvider {
  return (LIVE_QUOTE_PROVIDERS as readonly string[]).includes(provider);
}

export function isMockCatalogProvider(provider: string): boolean {
  return provider === MARKET_PROVIDER.MOCK_CATALOG;
}

/** Modes that may serve static mock-catalog prices. */
export function dataModeAllowsMockCatalog(mode: MarketDataMode): boolean {
  return mode === 'mock';
}

/** Agent v2 always uses Yahoo live quotes and charts. */
export function marketModeUsesYahooLive(mode: MarketDataMode): boolean {
  return mode === 'live' || mode === 'agent-v2';
}

/** Agent mode uses LLM charts; table quotes follow quoteDataMode (live | mock). */
export function dataModeUsesLiveQuotes(mode: MarketDataMode, quoteDataMode: 'live' | 'mock'): boolean {
  if (marketModeUsesYahooLive(mode)) return true;
  if (mode === 'agent') return quoteDataMode === 'live';
  return false;
}
