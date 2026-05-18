import type { StockPrediction, TimeSeriesData } from '@investai/shared';
import { http, httpWithMeta } from '../../../shared/api/http';

export const dashboardApi = {
  getTimeSeries: (symbol: string) =>
    httpWithMeta<TimeSeriesData[]>(`/api/market/stocks/${symbol}/timeseries`),
  getPrediction: (
    symbol: string,
    historicalData: Array<{ date: string; price: number }>
  ) =>
    http<StockPrediction>(`/api/ai/stocks/${symbol}/prediction`, {
      method: 'POST',
      body: JSON.stringify({ historicalData }),
    }),
};
