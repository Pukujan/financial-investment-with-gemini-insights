import {
  dataModeAllowsMockCatalog,
  isLiveQuoteProvider,
  isMockCatalogProvider,
  type MarketDataMode,
} from '@investai/shared';
import { AppError } from '../middleware/errorHandler.js';

/** Live or agent-with-live quotes must not use mock-catalog provider. */
export function assertLiveQuoteProvider(
  provider: string,
  context: string
): asserts provider is 'yahoo' {
  if (isLiveQuoteProvider(provider)) return;
  if (isMockCatalogProvider(provider)) {
    throw new AppError(
      `Contract violation (${context}): mock-catalog provider in a live quote path`,
      500,
      'CONTRACT_MOCK_IN_LIVE_PATH'
    );
  }
  throw new AppError(
    `Contract violation (${context}): unexpected provider "${provider}"`,
    500,
    'CONTRACT_INVALID_PROVIDER'
  );
}

export function assertDataModeAllowsMockPrices(mode: MarketDataMode, context: string): void {
  if (dataModeAllowsMockCatalog(mode)) return;
  throw new AppError(
    `Contract violation (${context}): mock-catalog prices requested while dataMode=${mode}`,
    500,
    'CONTRACT_MOCK_MODE_REQUIRED'
  );
}
