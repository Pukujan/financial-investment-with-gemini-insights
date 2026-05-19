import { describe, it, expect } from 'vitest';
import { effectiveMarketCacheMode } from '../marketCacheMode.js';

describe('effectiveMarketCacheMode', () => {
  it('uses quote mode when dashboard is agent', () => {
    expect(effectiveMarketCacheMode('agent', 'live')).toBe('live');
    expect(effectiveMarketCacheMode('agent', 'mock')).toBe('mock');
  });

  it('uses data mode for live and mock', () => {
    expect(effectiveMarketCacheMode('live', 'live')).toBe('live');
    expect(effectiveMarketCacheMode('mock', 'mock')).toBe('mock');
  });
});
