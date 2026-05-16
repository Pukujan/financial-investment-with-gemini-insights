import type { Response } from 'express';
import type { ApiResponse } from '@investai/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>
): void {
  const body: ApiResponse<T> = { success: true, data, ...(meta ? { meta } : {}) };
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  message: string,
  status = 500
): void {
  res.status(status).json({ success: false, error: message });
}
