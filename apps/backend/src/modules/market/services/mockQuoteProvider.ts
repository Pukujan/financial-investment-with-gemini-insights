import type { StockQuote, TimeSeriesData } from '@investai/shared';
import { mockStocks } from '../../../data/mockData.js';

export const MOCK_PROVIDER = 'mock-catalog' as const;

export function getMockQuote(symbol: string): StockQuote {
  const catalog = mockStocks.find(s => s.symbol === symbol);
  if (!catalog) {
    throw new Error(`Unknown symbol: ${symbol}`);
  }

  return {
    symbol: catalog.symbol,
    name: catalog.name,
    sector: catalog.sector,
    price: catalog.price,
    change: catalog.change,
    changePercent: catalog.changePercent,
    high: catalog.price * 1.01,
    low: catalog.price * 0.99,
    open: catalog.price - catalog.change,
    previousClose: catalog.price - catalog.change,
    volume: catalog.volume,
    pe: catalog.pe,
    marketCap: catalog.marketCap,
  };
}

export function getAllMockQuotes(symbols: string[]): StockQuote[] {
  return symbols.map(symbol => getMockQuote(symbol));
}

export function getMockTimeSeries(symbol: string): TimeSeriesData[] {
  const catalog = mockStocks.find(s => s.symbol === symbol);
  const basePrice = catalog?.price ?? 100;

  return Array.from({ length: 30 }, (_, i) => {
    const variation = (Math.random() - 0.5) * basePrice * 0.05;
    const close = basePrice + variation;
    return {
      timestamp: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000_000,
    };
  });
}
