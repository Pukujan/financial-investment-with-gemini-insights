import { useState, useRef, useEffect } from 'react';
import type { MarketDataMode, StockPrediction, StockQuote, TimeSeriesData } from '@investai/shared';
import { ApiError } from '../../../shared/api/http';
import { dashboardApi } from '../services/dashboardApi';
import { useMarketData } from '../../market/controllers/MarketDataProvider';
import {
  agentChartStaleMessage,
  loadAgentChartSeries,
  saveAgentChartSeries,
} from '../../market/utils/agentChartStorage';
import { loadAgentV2ChartSeries } from '../../stocks/utils/agentV2ChartStorage';

export type ChartRange = '30d' | '7d' | '3d';

export interface ChartPoint {
  date: string;
  price: number;
}

export function useDashboardChart(_stocks: StockQuote[], dataMode: MarketDataMode) {
  const { requestAgentRefreshPrompt } = useMarketData();
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartNote, setChartNote] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('30d');
  const [prediction, setPrediction] = useState<StockPrediction | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedStock && chartRef.current) {
      chartRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedStock]);

  const loadChartData = async (symbol: string) => {
    setLoadingChart(true);
    setSelectedStock(symbol);
    setPrediction(null);
    setChartError(null);
    setChartNote(null);
    setTimeSeries([]);

    try {
      let timeSeries: TimeSeriesData[] | null = null;
      let meta: Record<string, unknown> | undefined;

      if (dataMode === 'agent') {
        const local = loadAgentChartSeries(symbol);
        if (local?.freshness === 'fresh') {
          timeSeries = local.series;
          meta = {
            chartNote: '30-day chart from agent scrape (browser cache, <12h).',
            chartSource: 'openrouter-agent',
          };
        } else if (local?.freshness === 'stale' && local.cachedAt) {
          timeSeries = local.series;
          meta = {
            chartNote: agentChartStaleMessage(local.cachedAt),
            chartStale: true,
            chartSource: 'openrouter-agent',
          };
          requestAgentRefreshPrompt();
        }
      }

      if (dataMode === 'agent-v2' && !timeSeries?.length) {
        const local = loadAgentV2ChartSeries(symbol);
        if (local) {
          timeSeries = local.series;
          meta = {
            chartNote: local.note,
            chartStale: local.stale,
            chartSource: 'yahoo',
          };
        }
      }

      if (!timeSeries?.length) {
        const res = await dashboardApi.getTimeSeries(symbol);
        timeSeries = res.data;
        meta = res.meta;
        if (dataMode === 'agent' && timeSeries.length) {
          saveAgentChartSeries(symbol, timeSeries);
          if (meta?.chartStale === true) {
            requestAgentRefreshPrompt();
          }
        }
      }

      const note = meta?.chartNote;
      setChartNote(
        typeof note === 'string'
          ? note
          : dataMode === 'agent-v2'
            ? '30-day chart from Yahoo Finance (Agent v2).'
            : null
      );
      setTimeSeries(timeSeries);
      setChartData(
        timeSeries.map(item => ({
          date: new Date(item.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          price: parseFloat(item.close.toFixed(2)),
        }))
      );
    } catch (error) {
      console.error('Error loading chart data:', error);
      setChartData([]);
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to load chart data';
      setChartError(message);
    } finally {
      setLoadingChart(false);
    }
  };

  const loadAIPrediction = async () => {
    if (!selectedStock || chartData.length === 0 || dataMode === 'agent-v2') return;
    setLoadingPrediction(true);
    try {
      setPrediction(await dashboardApi.getPrediction(selectedStock, chartData));
    } catch (error) {
      console.error('Error loading AI prediction:', error);
    } finally {
      setLoadingPrediction(false);
    }
  };

  const displayChartData = (() => {
    if (!chartData.length) return [];
    if (chartRange === '7d') return chartData.slice(-7);
    if (chartRange === '3d') return chartData.slice(-3);
    return chartData;
  })();

  return {
    selectedStock,
    chartRef,
    chartData,
    displayChartData,
    timeSeries,
    loadingChart,
    chartError,
    chartNote,
    chartRange,
    setChartRange,
    prediction,
    loadingPrediction,
    loadChartData,
    loadAIPrediction,
  };
}
