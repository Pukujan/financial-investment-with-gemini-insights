/**
 * Symbol universe + company metadata (no prices).
 * Safe for agent jobs, RAG, and stock fetch limits in any market mode.
 *
 * @see docs/MODULE_CONTRACTS.md — do not import mockMarketData for live prices.
 */
import { mockStocks } from './mockData.js';

export interface CatalogMetadata {
  symbol: string;
  name: string;
  sector: string;
  pe: number;
  marketCap: string;
}

const METADATA: CatalogMetadata[] = mockStocks.map(s => ({
  symbol: s.symbol,
  name: s.name,
  sector: s.sector,
  pe: s.pe,
  marketCap: s.marketCap,
}));

const bySymbol = new Map(METADATA.map(m => [m.symbol.toUpperCase(), m]));

/** All tracked symbols in catalog order. */
export function getTrackedSymbols(limit?: number): string[] {
  const all = METADATA.map(m => m.symbol);
  if (limit != null && limit > 0 && limit < all.length) {
    return all.slice(0, limit);
  }
  return all;
}

export function findCatalogMetadata(symbol: string): CatalogMetadata | undefined {
  return bySymbol.get(symbol.toUpperCase());
}

/** RAG / prompt context — explicitly excludes prices. */
export function catalogContextLine(meta: CatalogMetadata): string {
  return `${meta.name} (${meta.symbol}) — sector ${meta.sector}, market cap ${meta.marketCap}, P/E ${meta.pe}. Use as company context only; prices must come from extraction or golden reference.`;
}

export function listCatalogMetadata(): readonly CatalogMetadata[] {
  return METADATA;
}
