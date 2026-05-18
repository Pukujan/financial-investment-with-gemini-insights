import type { Request, Response } from 'express';
import { sendSuccess } from '../../../utils/response.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { env } from '../../../config/env.js';
import {
  agentScrapeConfigError,
  getAgentSymbols,
  isAgentScrapeConfigured,
} from '../../agent-scrape/services/agentScrapeService.js';
import { estimateAgentScrape, getTierCatalog } from '../services/aiEstimateService.js';

export const getTiers = asyncHandler(async (_req: Request, res: Response) => {
  if (!env.isOpenRouterConfigured()) {
    throw new AppError('OPENROUTER_API_KEY is required', 503, 'AI_NOT_CONFIGURED');
  }
  sendSuccess(res, await getTierCatalog());
});

export const getAgentScrapeEstimate = asyncHandler(async (req: Request, res: Response) => {
  if (!isAgentScrapeConfigured()) {
    throw new AppError(agentScrapeConfigError(), 503, 'AGENT_NOT_CONFIGURED');
  }
  const scrapeCharts = req.query.scrapeCharts === '1' || req.query.scrapeCharts === 'true';
  sendSuccess(res, await estimateAgentScrape(getAgentSymbols(), { scrapeCharts }));
});
