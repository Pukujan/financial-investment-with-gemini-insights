import { describe, expect, it } from 'vitest';
import { computeCostUsd, countLiveRequests, formatUsd } from '../costCalculator.js';

describe('costCalculator', () => {
  it('computes USD from per-token pricing', () => {
    const cost = computeCostUsd(
      { prompt: 1000, completion: 500 },
      { promptPerToken: 0.000001, completionPerToken: 0.000002 }
    );
    expect(cost).toBeCloseTo(0.002, 6);
  });

  it('counts live vs cached requests including news', () => {
    const { live, cached } = countLiveRequests(
      [{ cached: true }, { cached: false }],
      false
    );
    expect(live).toBe(2);
    expect(cached).toBe(1);
  });

  it('formats small USD amounts', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.00005)).toBe('< $0.0001');
    expect(formatUsd(0.05)).toBe('$0.050');
  });
});
