import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError
      ? err.message
      : process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

  const code = err instanceof AppError ? err.code : undefined;
  if (code === 'AGENT_JOB_NOT_FOUND') {
    console.warn('[Warn]', err.message, { code });
  } else {
    console.error('[Error]', err);
  }
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(code ? { code } : {}),
  });
}
