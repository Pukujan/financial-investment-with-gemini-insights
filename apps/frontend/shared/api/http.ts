import type { ApiResponse } from '@investai/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiUnreachableMessage(status: number): string {
  return (
    `API returned no data (HTTP ${status}). ` +
    'Start the backend with `npm run dev` from the repo root and ensure `PORT` in `.env` matches the Vite proxy (default 3004).'
  );
}

async function parseResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new ApiError(apiUnreachableMessage(res.status), res.status, 'API_EMPTY_RESPONSE');
  }

  let body: ApiResponse<T> & { error?: string; code?: string };
  try {
    body = JSON.parse(trimmed) as ApiResponse<T> & { error?: string; code?: string };
  } catch {
    const preview = trimmed.slice(0, 80).replace(/\s+/g, ' ');
    throw new ApiError(
      `Invalid API response (not JSON). ${preview.startsWith('<!') ? 'Got HTML — use the Vite dev server URL and keep VITE_API_URL empty.' : `Body: ${preview}`}`,
      res.status,
      'API_INVALID_JSON'
    );
  }

  if (!res.ok) {
    throw new ApiError(body.error ?? `Request failed: ${res.status}`, res.status, body.code);
  }

  return body;
}

export async function http<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const body = await parseResponse<T>(res);
  return body.data;
}

export async function httpWithMeta<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const body = await parseResponse<T>(res);
  return { data: body.data, meta: body.meta };
}
