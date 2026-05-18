import type { Request, Response } from 'express';
import {
  isDemoAuthEnabled,
  issueDemoToken,
  validateDemoCredentials,
  verifyDemoToken,
} from '../services/demoAuthService.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { sendSuccess } from '../../../utils/response.js';

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

export async function getAuthStatus(req: Request, res: Response): Promise<void> {
  const required = isDemoAuthEnabled();
  const token = bearerToken(req);
  sendSuccess(res, {
    /** Demo login is configured (optional — use token for shorter AI run cooldowns). */
    authRequired: required,
    authenticated: verifyDemoToken(token),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  if (!isDemoAuthEnabled()) {
    throw new AppError('Demo auth is not configured on this server', 503, 'AUTH_NOT_CONFIGURED');
  }

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    throw new AppError('Username and password are required', 400, 'AUTH_INVALID_REQUEST');
  }

  if (!validateDemoCredentials(username, password)) {
    throw new AppError('Invalid username or password', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  sendSuccess(res, {
    token: issueDemoToken(),
    expiresInHours: 168,
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, { ok: true });
}
