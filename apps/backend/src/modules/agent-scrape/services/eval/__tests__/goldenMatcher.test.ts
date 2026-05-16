import { describe, it, expect } from 'vitest';
import type { AgentGoldenCase } from '@investai/shared';
import type { StockQuote } from '@investai/shared';
import { scoreQuotesAgainstGolden } from '../goldenMatcher.js';

const golden: AgentGoldenCase = {
  id: 'test-quotes',
  description: 'test',
  kind: 'quotes',
  input: { symbols: ['AAPL'] },
  expected: {
    minQuoteCount: 1,
    quotes: [
      {
        symbol: 'AAPL',
        price: { min: 100, max: 300 },
        requiredFields: ['symbol', 'price', 'volume'],
      },
    ],
  },
};

describe('scoreQuotesAgainstGolden', () => {
  it('passes when quote matches golden band', () => {
    const quotes: StockQuote[] = [
      {
        symbol: 'AAPL',
        price: 178,
        change: 1,
        changePercent: 0.5,
        high: 180,
        low: 176,
        open: 177,
        previousClose: 177,
        volume: '10M',
      },
    ];
    const result = scoreQuotesAgainstGolden(quotes, golden);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails when price outside band', () => {
    const quotes: StockQuote[] = [
      {
        symbol: 'AAPL',
        price: 50,
        change: 0,
        changePercent: 0,
        high: 50,
        low: 50,
        open: 50,
        previousClose: 50,
        volume: '10M',
      },
    ];
    const result = scoreQuotesAgainstGolden(quotes, golden);
    expect(result.passed).toBe(false);
    expect(result.failures.some(f => f.includes('outside band'))).toBe(true);
  });
});
