/**
 * Files allowed to import mock price data (mockData / mockMarketData).
 * Enforced by importBoundaries.test.ts — update when adding a legitimate mock-only consumer.
 *
 * Paths are relative to `apps/backend/`.
 */
export const MOCK_PRICE_IMPORT_ALLOWLIST = [
  'src/data/mockData.ts',
  'src/data/mockMarketData.ts',
  'src/data/symbolCatalog.ts',
  'src/data/demoNewsCatalog.ts',
  'src/modules/market/services/mockQuoteProvider.ts',
  'src/modules/market/services/marketService.ts',
] as const;

export const MOCK_PRICE_IMPORT_PATTERNS = [
  /from\s+['"].*mockData/,
  /from\s+['"].*mockMarketData/,
] as const;
