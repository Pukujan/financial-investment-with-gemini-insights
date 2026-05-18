import { describe, it, expect, beforeEach } from 'vitest';
import {
  cacheKey,
  clearMemoryCache,
  getMemoryCached,
  setMemoryCached,
} from '../memoryCache.js';

describe('memoryCache', () => {
  beforeEach(() => {
    clearMemoryCache();
  });

  it('stores and retrieves within TTL', () => {
    const key = cacheKey('market', 'quote', 'AAPL');
    setMemoryCached(key, { price: 100 });
    expect(getMemoryCached<{ price: number }>(key, 60_000)?.price).toBe(100);
  });

  it('returns null after TTL expires', async () => {
    const key = cacheKey('test', 'item');
    setMemoryCached(key, 'value');
    expect(getMemoryCached(key, 10)).toBe('value');
    await new Promise(r => setTimeout(r, 15));
    expect(getMemoryCached(key, 10)).toBeNull();
  });

  it('uses namespaced keys per module', () => {
    setMemoryCached(cacheKey('market', 'news'), ['a']);
    setMemoryCached(cacheKey('ai', 'insights'), ['b']);
    expect(getMemoryCached<string[]>(cacheKey('market', 'news'), 60_000)).toEqual(['a']);
    expect(getMemoryCached<string[]>(cacheKey('ai', 'insights'), 60_000)).toEqual(['b']);
  });
});
