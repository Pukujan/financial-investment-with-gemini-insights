import { describe, expect, it } from 'vitest';
import { AppError } from '../../middleware/errorHandler.js';
import { assertLiveQuoteProvider } from '../marketPath.js';

describe('marketPath contracts', () => {
  it('allows yahoo provider', () => {
    expect(() => assertLiveQuoteProvider('yahoo', 'test')).not.toThrow();
  });

  it('rejects mock-catalog on live path', () => {
    expect(() => assertLiveQuoteProvider('mock-catalog', 'test')).toThrow(AppError);
    try {
      assertLiveQuoteProvider('mock-catalog', 'test');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('CONTRACT_MOCK_IN_LIVE_PATH');
    }
  });
});
