import { AlertCircle, CheckCircle2, Clock, Database, Sparkles } from 'lucide-react';
import type { AgentCacheInfo } from '@investai/shared';

const STATE_STYLES: Record<
  AgentCacheInfo['state'],
  { border: string; bg: string; text: string; icon: typeof Database }
> = {
  no_data: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    icon: AlertCircle,
  },
  needs_scrape: {
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    text: 'text-orange-900',
    icon: Sparkles,
  },
  partial: {
    border: 'border-sky-300',
    bg: 'bg-sky-50',
    text: 'text-sky-900',
    icon: Database,
  },
  ready_fresh: {
    border: 'border-emerald-300',
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    icon: CheckCircle2,
  },
  ready_aging: {
    border: 'border-yellow-300',
    bg: 'bg-yellow-50',
    text: 'text-yellow-900',
    icon: Clock,
  },
};

interface AgentCacheStatusBadgeProps {
  cache: AgentCacheInfo;
}

export function AgentCacheStatusBadge({ cache }: AgentCacheStatusBadgeProps) {
  const style = STATE_STYLES[cache.state];
  const Icon = style.icon;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${style.border} ${style.bg}`}
      role="status"
    >
      <div className="flex gap-2.5">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.text}`} />
        <div className="min-w-0">
          <p className={`font-medium text-sm ${style.text}`}>{cache.label}</p>
          <p className={`text-xs mt-0.5 ${style.text} opacity-90`}>{cache.detail}</p>
          {cache.cachedAt && (
            <p className={`text-xs mt-1 ${style.text} opacity-75`}>
              Cached at{' '}
              {new Date(cache.cachedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {cache.cacheExpiresAt && (
                <>
                  {' '}
                  · expires{' '}
                  {new Date(cache.cacheExpiresAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
