import type { StockQuote } from '@investai/shared';

export function normalizeAgentQuote(symbol: string, partial: Partial<StockQuote>): StockQuote {
  const price = Number(partial.price) || 100;
  const change = Number(partial.change) || 0;
  const changePercent =
    typeof partial.changePercent === 'number'
      ? partial.changePercent
      : price
        ? (change / price) * 100
        : 0;
  const previousClose = Number(partial.previousClose) || price - change;

  return {
    symbol,
    name: partial.name ?? symbol,
    sector: partial.sector,
    price,
    change,
    changePercent,
    high: Number(partial.high) || price * 1.01,
    low: Number(partial.low) || price * 0.99,
    open: Number(partial.open) || previousClose,
    previousClose,
    volume: partial.volume ?? '—',
    pe: partial.pe,
    marketCap: partial.marketCap,
  };
}
