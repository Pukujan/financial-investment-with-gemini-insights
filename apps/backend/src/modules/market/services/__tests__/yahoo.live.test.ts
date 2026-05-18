import { describe, it, expect } from 'vitest';
import { fetchYahooBulk, probeYahooProvider } from '../yahooProvider.js';

const runLive = process.env.RUN_YAHOO_INTEGRATION === '1';

describe.runIf(runLive)('Yahoo live integration (yahoo-finance2)', () => {
  it('probes AAPL', async () => {
    const probe = await probeYahooProvider();
    expect(probe.reachable).toBe(true);
  });

  it('fetches bulk for two symbols', async () => {
    const bulk = await fetchYahooBulk(['AAPL', 'MSFT']);
    expect(bulk.quotes.length).toBeGreaterThan(0);
    expect(bulk.seriesBySymbol.get('AAPL')?.length).toBeGreaterThan(0);
  });
});
