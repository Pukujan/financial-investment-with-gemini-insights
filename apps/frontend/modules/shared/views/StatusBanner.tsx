import { AlertTriangle, Info } from 'lucide-react';

interface StatusBannerProps {
  error?: string | null;
  errorCode?: string | null;
  warnings?: string[];
  loading?: boolean;
}

function errorTitle(code: string | null | undefined): string {
  switch (code) {
    case 'MARKET_LIVE_UNAVAILABLE':
      return 'Live market data unavailable';
    case 'MARKET_NEWS_FORBIDDEN':
      return 'Live news not available on your plan';
    case 'MARKET_NEWS_UNAVAILABLE':
      return 'Live news unavailable';
    case 'AI_NOT_CONFIGURED':
      return 'AI not configured';
    case 'AI_INSUFFICIENT_MARKET_DATA':
      return 'Not enough market data for AI';
    case 'AI_GENERATION_FAILED':
    case 'AI_INVALID_RESPONSE':
      return 'AI insights generation failed';
    case 'AGENT_NOT_CONFIGURED':
      return 'Agent scrape not configured';
    case 'AGENT_SCRAPE_FAILED':
      return 'Agent scrape failed';
    case 'AGENT_SCRAPE_TIMEOUT':
      return 'Agent scrape timed out';
    case 'AGENT_JOB_BUSY':
      return 'Agent scrape already running';
    case 'AGENT_ESTIMATE_FAILED':
    case 'API_EMPTY_RESPONSE':
    case 'API_INVALID_JSON':
      return 'Cannot reach API';
    case 'MARKET_DATA_UNAVAILABLE':
      return 'Market data required';
    default:
      return 'Something went wrong';
  }
}

export function StatusBanner({ error, errorCode, warnings = [], loading }: StatusBannerProps) {
  if (loading) return null;
  if (!error && warnings.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
          <div>
            <p className="font-medium">{errorTitle(errorCode)}</p>
            <p className="mt-1 text-red-800">{error}</p>
            {errorCode === 'MARKET_LIVE_UNAVAILABLE' && (
              <p className="mt-2 text-red-700">
                Toggle to <strong>Mock</strong> in the header, or wait for Yahoo rate limits to reset
                and click <strong>Refresh</strong>. Run a stock refresh so charts preload from bulk
                cache.
              </p>
            )}
            {(errorCode === 'API_EMPTY_RESPONSE' ||
              errorCode === 'API_INVALID_JSON' ||
              errorCode === 'AGENT_ESTIMATE_FAILED') && (
              <p className="mt-2 text-red-700">
                Run <code className="text-xs">npm run dev</code> from the project root (starts backend
                + frontend). Backend uses <code className="text-xs">PORT</code> from{' '}
                <code className="text-xs">.env</code> (yours is 3004). Leave{' '}
                <code className="text-xs">VITE_API_URL</code> empty in dev.
              </p>
            )}
            {(errorCode === 'MARKET_NEWS_FORBIDDEN' ||
              errorCode === 'AI_NOT_CONFIGURED' ||
              errorCode === 'AGENT_NOT_CONFIGURED') && (
              <p className="mt-2 text-red-700">
                Toggle to <strong>Mock</strong> in the header, or fix the configuration in{' '}
                <code className="text-xs">.env</code>.
              </p>
            )}
          </div>
        </div>
      )}
      {warnings.map(warning => (
        <div
          key={warning}
          role="status"
          className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <Info className="w-5 h-5 shrink-0 text-amber-600" />
          <p>{warning}</p>
        </div>
      ))}
    </div>
  );
}
