import { env } from '../config/env.js';

const TIINGO_BASE = 'https://api.tiingo.com';

export async function tiingoGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  if (!env.tiingoApiToken) {
    throw new Error('TIINGO_API_TOKEN is not configured');
  }

  const url = new URL(`${TIINGO_BASE}${path}`);
  url.searchParams.set('token', env.tiingoApiToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Tiingo HTTP ${response.status}: ${response.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`
    );
  }

  return (await response.json()) as T;
}
