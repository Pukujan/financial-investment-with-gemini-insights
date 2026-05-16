import { env } from '../../../config/env.js';
import { TIINGO_PROVIDER } from './tiingoProvider.js';

export const LIVE_PROVIDER = TIINGO_PROVIDER;

export function isLiveMarketConfigured(): boolean {
  return env.isTiingoConfigured();
}

export function liveMarketConfigError(): string {
  return 'TIINGO_API_TOKEN is not configured. Add your token to .env or switch to Mock data.';
}

/** When the token exists but Tiingo returned no usable quotes (rate limits, outage, etc.). */
export function liveMarketFetchError(): string {
  return (
    'Could not load live prices from Tiingo (all symbol requests failed). ' +
    'You may have hit hourly rate limits — wait and use Refresh, reduce STOCK_FETCH_LIMIT, or switch to Mock data.'
  );
}

export function liveMarketErrorMessage(): string {
  return isLiveMarketConfigured() ? liveMarketFetchError() : liveMarketConfigError();
}
