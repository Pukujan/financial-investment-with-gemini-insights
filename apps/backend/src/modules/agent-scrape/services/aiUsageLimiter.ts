import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PromptEvalCooldownStatus } from '@investai/shared';
import { verifyDemoToken } from '../../auth/services/demoAuthService.js';
import { AppError } from '../../../middleware/errorHandler.js';
import type { Request } from 'express';

export type UsageLimitScope = 'agent-run' | 'prompt-test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIMITS_FILE = path.resolve(__dirname, '../../../../.data/ai-usage-limits.json');

const ANON_COOLDOWN_MS =
  (Number(process.env.AI_USAGE_ANON_COOLDOWN_HOURS ?? process.env.PROMPT_EVAL_COOLDOWN_HOURS) > 0
    ? Number(process.env.AI_USAGE_ANON_COOLDOWN_HOURS ?? process.env.PROMPT_EVAL_COOLDOWN_HOURS)
    : 1) *
  60 *
  60 *
  1000;

const AUTH_COOLDOWN_MS =
  (Number(process.env.AI_USAGE_AUTH_COOLDOWN_MINUTES ?? process.env.PROMPT_EVAL_AUTH_COOLDOWN_MINUTES) >
  0
    ? Number(process.env.AI_USAGE_AUTH_COOLDOWN_MINUTES ?? process.env.PROMPT_EVAL_AUTH_COOLDOWN_MINUTES)
    : 15) *
  60 *
  1000;

const AUTH_DAILY_MAX =
  Number(process.env.AI_USAGE_AUTH_DAILY_MAX ?? process.env.PROMPT_EVAL_AUTH_DAILY_MAX) > 0
    ? Number(process.env.AI_USAGE_AUTH_DAILY_MAX ?? process.env.PROMPT_EVAL_AUTH_DAILY_MAX)
    : 5;

interface ScopeState {
  lastAnonymousRunAt: number;
  lastAuthenticatedRunAt: number;
  authDailyDate: string;
  authDailyCount: number;
}

interface LimitsFile {
  agentRun: ScopeState;
  promptTest: ScopeState;
}

function emptyScopeState(): ScopeState {
  return {
    lastAnonymousRunAt: 0,
    lastAuthenticatedRunAt: 0,
    authDailyDate: utcDateKey(),
    authDailyCount: 0,
  };
}

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function loadFile(): LimitsFile {
  try {
    if (!fs.existsSync(LIMITS_FILE)) {
      return { agentRun: emptyScopeState(), promptTest: emptyScopeState() };
    }
    const parsed = JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8')) as Partial<LimitsFile>;
    return {
      agentRun: { ...emptyScopeState(), ...parsed.agentRun },
      promptTest: { ...emptyScopeState(), ...parsed.promptTest },
    };
  } catch {
    return { agentRun: emptyScopeState(), promptTest: emptyScopeState() };
  }
}

let fileState = loadFile();

/** Reload limits from disk (dev reset / tests). */
export function reloadUsageLimitsFromDisk(): void {
  fileState = loadFile();
}

function persistFile(): void {
  try {
    const dir = path.dirname(LIMITS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(fileState, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ai-usage-limiter] Could not persist:', err);
  }
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

export function isUsageLimitAuthenticated(req: Request): boolean {
  return verifyDemoToken(bearerToken(req));
}

function authDailyUsage(scope: ScopeState): { used: number; limit: number; remaining: number } {
  const today = utcDateKey();
  if (scope.authDailyDate !== today) {
    return { used: 0, limit: AUTH_DAILY_MAX, remaining: AUTH_DAILY_MAX };
  }
  const used = scope.authDailyCount;
  return { used, limit: AUTH_DAILY_MAX, remaining: Math.max(0, AUTH_DAILY_MAX - used) };
}

export function getUsageLimitStatus(
  scope: UsageLimitScope,
  req?: Request
): PromptEvalCooldownStatus {
  const state = fileState[scope === 'agent-run' ? 'agentRun' : 'promptTest'];
  const authenticated = req ? isUsageLimitAuthenticated(req) : false;
  const daily = authDailyUsage(state);

  if (authenticated) {
    if (daily.remaining <= 0) {
      return {
        allowed: false,
        authenticated: true,
        authenticatedBypass: true,
        cooldownMs: AUTH_COOLDOWN_MS,
        remainingMs: 0,
        nextAllowedAt: null,
        dailyLimit: daily.limit,
        dailyRunsUsed: daily.used,
        dailyRunsRemaining: 0,
        blockReason: 'daily_limit',
      };
    }

    const elapsed = Date.now() - state.lastAuthenticatedRunAt;
    const remainingMs = Math.max(0, AUTH_COOLDOWN_MS - elapsed);
    return {
      allowed: remainingMs === 0,
      authenticated: true,
      authenticatedBypass: true,
      cooldownMs: AUTH_COOLDOWN_MS,
      remainingMs,
      nextAllowedAt:
        remainingMs > 0 ? new Date(Date.now() + remainingMs).toISOString() : null,
      dailyLimit: daily.limit,
      dailyRunsUsed: daily.used,
      dailyRunsRemaining: daily.remaining,
      blockReason: remainingMs > 0 ? 'cooldown' : null,
    };
  }

  const elapsed = Date.now() - state.lastAnonymousRunAt;
  const remainingMs = Math.max(0, ANON_COOLDOWN_MS - elapsed);
  return {
    allowed: remainingMs === 0,
    authenticated: false,
    authenticatedBypass: false,
    cooldownMs: ANON_COOLDOWN_MS,
    remainingMs,
    nextAllowedAt:
      remainingMs > 0 ? new Date(Date.now() + remainingMs).toISOString() : null,
    dailyLimit: null,
    dailyRunsUsed: null,
    dailyRunsRemaining: null,
    blockReason: remainingMs > 0 ? 'cooldown' : null,
  };
}

export function getAllUsageLimitStatuses(req?: Request): {
  agentRun: PromptEvalCooldownStatus;
  promptTest: PromptEvalCooldownStatus;
} {
  return {
    agentRun: getUsageLimitStatus('agent-run', req),
    promptTest: getUsageLimitStatus('prompt-test', req),
  };
}

function scopeLabel(scope: UsageLimitScope): string {
  return scope === 'agent-run' ? 'Agent chart job' : 'Eval prompt test';
}

export function assertUsageLimit(scope: UsageLimitScope, req: Request): void {
  const status = getUsageLimitStatus(scope, req);
  if (status.allowed) return;

  if (status.blockReason === 'daily_limit') {
    throw new AppError(
      `${scopeLabel(scope)}: daily limit reached (${status.dailyRunsUsed}/${status.dailyLimit} runs today UTC).`,
      429,
      'AI_USAGE_DAILY_LIMIT'
    );
  }

  const mins = Math.ceil(status.remainingMs / 60_000);
  const hint = status.authenticated
    ? `Signed-in: ${status.dailyRunsRemaining ?? 0} run(s) left today after cooldown.`
    : 'Sign in for a 15-minute cooldown (5 runs/day max).';
  throw new AppError(
    `${scopeLabel(scope)}: wait ${mins} minute(s). ${hint}`,
    429,
    'AI_USAGE_COOLDOWN'
  );
}

export function recordUsageLimitRun(scope: UsageLimitScope, req: Request): void {
  const now = Date.now();
  const today = utcDateKey();
  const key = scope === 'agent-run' ? 'agentRun' : 'promptTest';
  const state = fileState[key];

  if (isUsageLimitAuthenticated(req)) {
    if (state.authDailyDate !== today) {
      state.authDailyDate = today;
      state.authDailyCount = 0;
    }
    state.authDailyCount += 1;
    state.lastAuthenticatedRunAt = now;
  } else {
    state.lastAnonymousRunAt = now;
  }

  persistFile();
}

export function resetUsageLimitsForTests(): void {
  fileState = { agentRun: emptyScopeState(), promptTest: emptyScopeState() };
  persistFile();
}

/** Clear agent-run + prompt-test cooldowns (development only). */
export function resetUsageLimitsNow(): void {
  resetUsageLimitsForTests();
}
