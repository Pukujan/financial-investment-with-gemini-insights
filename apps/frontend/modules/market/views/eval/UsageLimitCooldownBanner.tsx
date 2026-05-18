import type { PromptEvalCooldownStatus } from '@investai/shared';

interface UsageLimitCooldownBannerProps {
  status: PromptEvalCooldownStatus | null;
  scopeLabel?: string;
  onSignIn?: () => void;
}

export function UsageLimitCooldownBanner({
  status,
  scopeLabel = 'runs',
  onSignIn,
}: UsageLimitCooldownBannerProps) {
  if (!status) return null;

  const showSignIn = onSignIn && !status.authenticated;
  const signInUrgent = !status.allowed;

  return (
    <div
      className={`text-sm rounded-lg px-3 py-2 border space-y-2 ${
        !status.allowed
          ? 'text-amber-800 bg-amber-50 border-amber-200'
          : status.authenticated
            ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
            : 'text-slate-600 bg-slate-50 border-slate-200'
      }`}
    >
      <p>
        {status.authenticated
          ? status.allowed
            ? `Signed in — ${status.dailyRunsRemaining ?? 0} of ${status.dailyLimit ?? 5} ${scopeLabel} left today (15 min between runs).`
            : status.blockReason === 'daily_limit'
              ? `Daily limit reached (${status.dailyRunsUsed}/${status.dailyLimit} ${scopeLabel} today UTC).`
              : `Signed-in cooldown — wait ${Math.ceil(status.remainingMs / 60_000)} min (${status.dailyRunsRemaining ?? 0} left today).`
          : status.allowed
            ? `Ready (${scopeLabel}: 1h between anonymous runs). Sign in for 15m / 5 per day.`
            : `Cooldown active (${Math.ceil(status.remainingMs / 60_000)} min left). Sign in for shorter cooldown (15m, max 5/day).`}
      </p>
      {showSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          className={`text-sm font-medium underline hover:no-underline ${
            signInUrgent ? 'text-amber-950' : 'text-slate-700'
          }`}
        >
          {signInUrgent
            ? 'Sign in to skip the 1h wait (15m cooldown, 5 runs/day)'
            : 'Sign in for shorter cooldown (15m, 5 runs/day)'}
        </button>
      )}
    </div>
  );
}
