import type { Request, Response } from 'express';
import type { Holding } from '@investai/shared';
import { sendSuccess } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../middleware/errorHandler.js';
import * as portfolioService from '../services/portfolioService.js';

export const getPortfolio = asyncHandler(async (_req: Request, res: Response) => {
  const portfolio = await portfolioService.getPortfolio();
  sendSuccess(res, portfolio);
});

export const updatePortfolio = asyncHandler(async (req: Request, res: Response) => {
  const { holdings } = req.body as { holdings?: Holding[] };

  if (!Array.isArray(holdings)) {
    throw new AppError('holdings array is required', 400);
  }

  const portfolio = await portfolioService.savePortfolio(holdings);
  sendSuccess(res, portfolio);
});
