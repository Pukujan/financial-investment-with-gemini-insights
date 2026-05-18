import type { NextFunction, Request, Response } from 'express';

/**
 * Demo auth is optional: anonymous API access is allowed.
 * A valid Bearer token only upgrades usage limits (see aiUsageLimiter).
 */
export function requireDemoAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
