import { YAHOO_PROVIDER } from './yahooProvider.js';

export type ResolvedLiveProvider = typeof YAHOO_PROVIDER;

/** Live market data uses Yahoo Finance only (yahoo-finance2). */
export function resolveLiveProvider(): ResolvedLiveProvider {
  return YAHOO_PROVIDER;
}

export function isLiveMarketConfigured(): boolean {
  return true;
}

export function liveMarketConfigError(): string {
  return 'Yahoo live provider could not be reached. Try again later or check your network.';
}

export function liveMarketFetchError(): string {
  return (
    'Could not load live prices from Yahoo Finance (all symbol requests failed). ' +
    'Yahoo may be rate-limiting — wait and use Refresh, or reduce STOCK_FETCH_LIMIT.'
  );
}

export function liveMarketErrorMessage(): string {
  return isLiveMarketConfigured() ? liveMarketFetchError() : liveMarketConfigError();
}
