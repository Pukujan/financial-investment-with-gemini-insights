import { describe, expect, it, beforeEach } from 'vitest';
import type { Request } from 'express';
import {
  getPromptEvalCooldownStatus,
  recordPromptEvalCooldownRun,
  resetPromptEvalCooldownForTests,
} from '../promptEvalCooldown.js';

function mockReq(token?: string): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as Request;
}

describe('promptEvalCooldown', () => {
  beforeEach(() => {
    resetPromptEvalCooldownForTests();
  });

  it('blocks anonymous users for 1h after a run', () => {
    recordPromptEvalCooldownRun(mockReq());
    const status = getPromptEvalCooldownStatus(mockReq());
    expect(status.allowed).toBe(false);
    expect(status.authenticated).toBe(false);
    expect(status.remainingMs).toBeGreaterThan(0);
  });

  it('allows anonymous after cooldown window (mocked via fresh state)', () => {
    const status = getPromptEvalCooldownStatus(mockReq());
    expect(status.allowed).toBe(true);
    expect(status.dailyLimit).toBeNull();
  });
});
