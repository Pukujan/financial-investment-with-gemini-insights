import type { Request, Response } from 'express';
import type { AiCostTier, MarketDataMode, QuoteDataMode } from '@investai/shared';
import { parseAiCostTier } from '../../agent-scrape/services/agentScrapeService.js';
import { sendSuccess } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { getMarketDataMode } from '../../../config/marketDataMode.js';
import * as marketService from '../services/marketService.js';

export const getStocks = asyncHandler(async (req: Request, res: Response) => {
  const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const forceLive = req.query.forceLive === '1' || req.query.forceLive === 'true';
  const agentTier = parseAiCostTier(req.query.agentTier) as AiCostTier | undefined;
  const { stocks, meta } = await marketService.getAllStocks({ refresh, forceLive, agentTier });
  sendSuccess(res, stocks, 200, { count: stocks.length, ...meta });
});

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const probe = req.query.probe === '1' || req.query.probe === 'true';
  const settings = await marketService.getMarketSettings(probe);
  sendSuccess(res, settings);
});

export const putSettings = asyncHandler(async (req: Request, res: Response) => {
  const { dataMode, quoteDataMode } = req.body as {
    dataMode?: MarketDataMode;
    quoteDataMode?: QuoteDataMode;
  };
  if (!dataMode && !quoteDataMode) {
    throw new AppError(
      'dataMode or quoteDataMode is required',
      400,
      'INVALID_MARKET_MODE'
    );
  }
  const settings = marketService.updateMarketDataMode(
    dataMode ?? getMarketDataMode(),
    quoteDataMode
  );
  sendSuccess(res, settings);
});

export const getNews = asyncHandler(async (req: Request, res: Response) => {
  const agentTier = parseAiCostTier(req.query.agentTier) as AiCostTier | undefined;
  const { articles, meta } = await marketService.getMarketNewsWithMeta({ agentTier });
  sendSuccess(res, articles, 200, meta);
});

export const getTimeSeries = asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;
  if (!symbol) {
    throw new AppError('Symbol is required', 400);
  }
  const sym = String(symbol).toUpperCase();
  const data = await marketService.getTimeSeriesDaily(sym);
  const meta = marketService.getTimeSeriesMeta(sym);
  sendSuccess(res, data, 200, meta);
});
