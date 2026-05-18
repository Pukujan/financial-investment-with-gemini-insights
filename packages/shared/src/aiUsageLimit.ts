/** Cost-protection tiers for OpenRouter / agent AI calls (not tied to login). */

export type AiUsageTier = 'heavy' | 'standard';

export interface AiUsageLimitStatus {
  tier: AiUsageTier;
  allowed: boolean;
  cooldownMs: number;
  remainingMs: number;
  nextAllowedAt: string | null;
  /** heavy tier only — max runs per UTC day */
  dailyLimit: number | null;
  dailyRunsUsed: number | null;
  dailyRunsRemaining: number | null;
  blockReason: 'cooldown' | 'daily_limit' | null;
  label: string;
  description: string;
}

export interface AiUsageLimitsOverview {
  heavy: AiUsageLimitStatus;
  standard: AiUsageLimitStatus;
}
