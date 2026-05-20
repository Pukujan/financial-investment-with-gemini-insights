import type { Request, Response } from 'express';
import type { HealthStatus } from '@investai/shared';
import { env, validateEnv } from '../../../config/env.js';
import { getMarketDataMode } from '../../../config/marketDataMode.js';
import { resolveLiveProvider } from '../../market/services/liveMarketProvider.js';
import { probeLiveProvider } from '../../market/services/marketService.js';
import { sendSuccess } from '../../../utils/response.js';

const startTime = Date.now();

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const envCheck = validateEnv();
  const firebaseConfigured = env.isFirebaseConfigured();
  const openRouterConfigured = env.isOpenRouterConfigured();
  const marketDataMode = getMarketDataMode();
  const liveProbe =
    marketDataMode === 'live' && env.nodeEnv !== 'test'
      ? await probeLiveProvider()
      : { reachable: null as boolean | null };

  let status: HealthStatus['status'] = 'ok';
  if (!openRouterConfigured) {
    status = 'degraded';
  }
  if (marketDataMode === 'live' && liveProbe.reachable === false) {
    status = 'degraded';
  }
  if (!envCheck.ok && env.nodeEnv === 'production') {
    status = 'degraded';
  }

  const gitCommitSha =
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.RAILWAY_GIT_COMMIT?.trim() ||
    process.env.GIT_COMMIT?.trim() ||
    undefined;

  const healthStatus: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: env.appVersion,
    gitCommitSha,
    checks: {
      firebase: firebaseConfigured ? 'ok' : 'unconfigured',
      openrouter: openRouterConfigured ? 'ok' : 'unconfigured',
      openrouterPrimaryModel: env.openRouterModelPrimary,
      openrouterFallbackModel: env.openRouterModelFallback,
      marketDataMode,
      marketLiveProvider: marketDataMode === 'live' ? resolveLiveProvider() : 'mock-catalog',
      marketLiveReachable: liveProbe.reachable,
    },
    env: {
      missing: envCheck.missing,
      warnings: envCheck.warnings,
    },
  };

  sendSuccess(res, healthStatus);
}
