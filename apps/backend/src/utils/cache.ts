/**
 * @deprecated Import from `./memoryCache.js` and `../config/cache.js` instead.
 */
export {
  getMemoryCached as getCachedData,
  setMemoryCached as setCachedData,
  clearMemoryCache as clearCache,
} from './memoryCache.js';

export { memoryCacheTtl } from '../config/cache.js';

/** @deprecated Use memoryCacheTtl.marketQuoteMs */
export const CACHE_DURATION_MS = 60_000;
