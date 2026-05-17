import { useMarketData } from '../controllers/MarketDataProvider';
import { StatusBanner } from '@/modules/shared/views/StatusBanner';
import { AgentScrapePanel } from './AgentScrapePanel';
import { filterStatusForDataMode } from '../utils/filterMarketStatus';

export function MarketDataBanner() {
  const {
    error,
    errorCode,
    warnings,
    newsError,
    newsErrorCode,
    dataMode,
    liveReachable,
    loading,
  } = useMarketData();

  const showLiveWarning = dataMode === 'live' && liveReachable === false && !error;

  const combinedWarnings = [
    ...warnings,
    ...(showLiveWarning
      ? ['Live market API is not reachable. Stock requests may fail until connectivity returns.']
      : []),
  ];

  const rawError = error ?? newsError;
  const rawCode = errorCode ?? newsErrorCode;
  const { error: displayError, errorCode: displayCode, warnings: displayWarnings } =
    filterStatusForDataMode(dataMode, rawError, rawCode, error ? warnings : combinedWarnings);

  return (
    <>
      {dataMode === 'agent' && <AgentScrapePanel />}
      <StatusBanner
        error={displayError}
        errorCode={displayCode}
        warnings={displayWarnings}
        loading={loading && dataMode !== 'agent'}
      />
    </>
  );
}
