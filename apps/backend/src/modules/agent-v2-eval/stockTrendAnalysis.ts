import type { StockOHLCVPoint, StockTrendAnalysis, TimeSeriesData } from '@investai/shared';

export function normalizeTimeSeriesToOHLCV(history: TimeSeriesData[]): StockOHLCVPoint[] {
  return history
    .map(row => ({
      date: row.timestamp.split('T')[0] ?? row.timestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }))
    .filter(
      row =>
        Number.isFinite(row.open) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.close) &&
        Number.isFinite(row.volume)
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function dailyCloseMoves(closes: number[]): number[] {
  const moves: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    if (prev === 0) continue;
    moves.push(Math.abs(((closes[i]! - prev) / prev) * 100));
  }
  return moves;
}

export function analyzeThirtyDayTrend(
  symbol: string,
  history: StockOHLCVPoint[]
): StockTrendAnalysis | null {
  if (history.length < 2) return null;

  const startClose = history[0]!.close;
  const latestClose = history[history.length - 1]!.close;
  const priceChangePercent = startClose === 0 ? 0 : ((latestClose - startClose) / startClose) * 100;

  const volumes = history.map(h => h.volume);
  const averageVolume = average(volumes);
  const recentAverageVolume = average(volumes.slice(-5));

  let volumeTrend: StockTrendAnalysis['volumeTrend'] = 'Flat';
  if (averageVolume > 0) {
    const ratio = recentAverageVolume / averageVolume;
    if (ratio >= 1.12) volumeTrend = 'Rising';
    else if (ratio <= 0.88) volumeTrend = 'Falling';
  }

  const moves = dailyCloseMoves(history.map(h => h.close));
  const avgMove = average(moves);
  let volatility: StockTrendAnalysis['volatility'] = 'Low';
  if (avgMove >= 2.2) volatility = 'High';
  else if (avgMove >= 1.1) volatility = 'Medium';

  const recentCloses = history.slice(-5).map(h => h.close);
  const recentUp =
    recentCloses.length >= 2 && recentCloses[recentCloses.length - 1]! > recentCloses[0]!;
  const recentDown =
    recentCloses.length >= 2 && recentCloses[recentCloses.length - 1]! < recentCloses[0]!;

  let momentum: StockTrendAnalysis['momentum'] = 'Neutral';
  if (priceChangePercent > 1.5 && recentUp) momentum = 'Bullish';
  else if (priceChangePercent < -1.5 && recentDown) momentum = 'Bearish';

  const trendSummary = `${symbol} moved ${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(
    1
  )}% over ${history.length} sessions with ${volumeTrend.toLowerCase()} volume and ${volatility.toLowerCase()} volatility.`;

  return {
    symbol: symbol.toUpperCase(),
    startClose,
    latestClose,
    priceChangePercent,
    averageVolume,
    recentAverageVolume,
    volumeTrend,
    volatility,
    momentum,
    trendSummary,
    sessionCount: history.length,
  };
}
