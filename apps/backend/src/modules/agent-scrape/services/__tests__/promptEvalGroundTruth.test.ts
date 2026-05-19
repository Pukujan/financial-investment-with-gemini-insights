import { describe, expect, it, vi } from 'vitest';
import {
  isClientGroundTruthFresh,
  resolvePromptEvalGroundTruth,
} from '../promptEvalGroundTruth.js';

const chartMock = vi.hoisted(() => vi.fn());

vi.mock('yahoo-finance2', () => ({
  default: vi.fn().mockImplementation(() => ({
    chart: chartMock,
  })),
}));

describe('resolvePromptEvalGroundTruth', () => {
  it('uses client localStorage payload when fresh', async () => {
    chartMock.mockReset();
    const cachedAt = new Date().toISOString();
    const result = await resolvePromptEvalGroundTruth(['AAPL', 'MSFT', 'GOOGL'], {
      cachedAt,
      source: 'localStorage',
      symbols: [
        { symbol: 'AAPL', yahooClose: 100, yahooPreviousClose: 99 },
        { symbol: 'MSFT', yahooClose: 200, yahooPreviousClose: 198 },
        { symbol: 'GOOGL', yahooClose: 150, yahooPreviousClose: 149 },
      ],
      seriesBySymbol: {
        AAPL: [{ timestamp: '2026-04-01', open: 1, high: 1, low: 1, close: 100, volume: 1 }],
      },
    });
    expect(result.goldenReference).toBe('cache');
    expect(result.groundTruthSource).toBe('localStorage');
    expect(chartMock).not.toHaveBeenCalled();
  });

  it('detects stale client cache', () => {
    const old = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    expect(isClientGroundTruthFresh(old)).toBe(false);
  });
});
