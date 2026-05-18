import { env } from '../../../config/env.js';
import { TIINGO_PROVIDER } from './tiingoProvider.js';
import { YAHOO_PROVIDER } from './yahooProvider.js';

export type ResolvedLiveProvider = typeof TIINGO_PROVIDER | typeof YAHOO_PROVIDER;

export function resolveLiveProvider(): ResolvedLiveProvider {
  if (env.marketLiveProvider === 'tiingo') return TIINGO_PROVIDER;
  return YAHOO_PROVIDER;
}

export function isLiveMarketConfigured(): boolean {
  const provider = resolveLiveProvider();
  if (provider === YAHOO_PROVIDER) return true;
  return env.isTiingoConfigured();
}

export function liveMarketConfigError(): string {
  const provider = resolveLiveProvider();
  if (provider === YAHOO_PROVIDER) {
    return 'Yahoo live provider could not be reached. Switch to Mock data or try again later.';
  }
  return 'TIINGO_API_TOKEN is not configured. Add your token, set MARKET_LIVE_PROVIDER=yahoo, or switch to Mock data.';
}

export function liveMarketFetchError(): string {
  const provider = resolveLiveProvider();
  if (provider === YAHOO_PROVIDER) {
    return (
      'Could not load live prices from Yahoo Finance (all symbol requests failed). ' +
      'Yahoo may be rate-limiting — wait and use Refresh, reduce STOCK_FETCH_LIMIT, or switch to Mock data.'
    );
  }
  return (
    'Could not load live prices from Tiingo (all symbol requests failed). ' +
    'You may have hit hourly rate limits — wait and use Refresh, reduce STOCK_FETCH_LIMIT, set MARKET_LIVE_PROVIDER=yahoo, or switch to Mock data.'
  );
}

export function liveMarketErrorMessage(): string {
  return isLiveMarketConfigured() ? liveMarketFetchError() : liveMarketConfigError();
}
