import type { ApiResponse } from '@investai/shared';
import { getAuthToken } from '@/modules/auth/utils/authStorage';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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
  const hint =
    status === 500
      ? 'The Vite proxy often returns HTTP 500 when the backend is down or crashed on startup — check the terminal running `npm run dev` for errors.'
      : 'Ensure the backend process is running.';
  return (
    `API returned no data (HTTP ${status}). ` +
    `Start the backend with \`npm run dev\` from the repo root. ${hint} ` +
    '`PORT` in the repo root `.env` must match what Vite proxies to (see backend log line `InvestAI API → http://localhost:…`).'
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
    const preview = trimmed.slice(0, 120).replace(/\s+/g, ' ');
    const isHtml = preview.startsWith('<!');
    const expressMissingRoute = /Cannot (GET|POST|PUT|DELETE|PATCH)/i.test(trimmed);
    const vercelSpa =
      isHtml &&
      !expressMissingRoute &&
      /InvestAI|vite\.svg|id="root"/i.test(trimmed);

    let message: string;
    if (expressMissingRoute) {
      message =
        'Backend returned 404 HTML for this route (stale deploy or wrong API host). ' +
        'Redeploy the backend from latest main, then confirm GET /api/health exposes prompt A/B routes.';
    } else if (vercelSpa) {
      message =
        'Got the frontend SPA instead of JSON. On Vercel set VITE_API_URL to your Railway API URL and redeploy. ' +
        'In local dev open http://localhost:5173 (npm run dev) and keep VITE_API_URL empty.';
    } else if (isHtml) {
      message =
        'Invalid API response (HTML). Use http://localhost:5173 in dev (VITE_API_URL empty), or set VITE_API_URL to your backend URL in production.';
    } else {
      message = `Invalid API response (not JSON). Body: ${preview}`;
    }

    throw new ApiError(message, res.status, 'API_INVALID_JSON');
  }

  if (!res.ok) {
    throw new ApiError(body.error ?? `Request failed: ${res.status}`, res.status, body.code);
  }

  return body;
}

export async function http<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
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
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    ...options,
  });
  const body = await parseResponse<T>(res);
  return { data: body.data, meta: body.meta };
}
