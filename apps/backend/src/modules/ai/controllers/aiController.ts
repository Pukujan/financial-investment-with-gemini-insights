import type { Request, Response } from 'express';
import { sendSuccess } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { getAIInsightsWithMeta } from '../services/insightsCacheService.js';
import { getCachedStockPrediction } from '../services/predictionCacheService.js';

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
  const { insights, meta } = await getAIInsightsWithMeta({ bypassCache: refresh });
  sendSuccess(res, insights, 200, meta);
});

export const getPrediction = asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const historicalData = req.body?.historicalData as
    | Array<{ date: string; price: number }>
    | undefined;

  if (!symbol) {
    throw new AppError('Symbol is required', 400);
  }
  if (!historicalData?.length) {
    throw new AppError('historicalData array is required in request body', 400);
  }

  const prediction = await getCachedStockPrediction(
    String(symbol).toUpperCase(),
    historicalData
  );
  sendSuccess(res, prediction);
});
