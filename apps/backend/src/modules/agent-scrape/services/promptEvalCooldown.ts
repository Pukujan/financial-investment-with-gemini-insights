import type { Request } from 'express';
import type { PromptEvalCooldownStatus } from '@investai/shared';
import {
  assertUsageLimit,
  getAllUsageLimitStatuses,
  getUsageLimitStatus,
  isUsageLimitAuthenticated,
  recordUsageLimitRun,
  resetUsageLimitsForTests,
} from './aiUsageLimiter.js';

export { isUsageLimitAuthenticated as isPromptEvalAuthenticated };

export function getPromptEvalCooldownStatus(req?: Request): PromptEvalCooldownStatus {
  return getUsageLimitStatus('prompt-test', req);
}

export function assertPromptEvalCooldown(req: Request): void {
  assertUsageLimit('prompt-test', req);
}

export function recordPromptEvalCooldownRun(req: Request): void {
  recordUsageLimitRun('prompt-test', req);
}

export function resetPromptEvalCooldownForTests(): void {
  resetUsageLimitsForTests();
}

export { getAllUsageLimitStatuses };
