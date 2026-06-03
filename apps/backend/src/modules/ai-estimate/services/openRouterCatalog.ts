import { env } from '../../../config/env.js';

const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_MS = 60 * 60 * 1000;

export interface OpenRouterModelPricing {
  id: string;
  name: string;
  promptPerToken: number;
  completionPerToken: number;
}

interface CatalogCache {
  fetchedAt: number;
  models: Map<string, OpenRouterModelPricing>;
}

let cache: CatalogCache | null = null;

function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeModel(raw: Record<string, unknown>): OpenRouterModelPricing | null {
  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!id) return null;

  const pricing = raw.pricing as Record<string, unknown> | undefined;
  const promptPerToken = parsePrice(pricing?.prompt);
  const completionPerToken = parsePrice(pricing?.completion);

  const name =
    typeof raw.name === 'string'
      ? raw.name
      : id.split('/').pop()?.replace(/-/g, ' ') ?? id;

  return {
    id,
    name,
    promptPerToken,
    completionPerToken,
  };
}

export async function fetchOpenRouterCatalog(): Promise<Map<string, OpenRouterModelPricing>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (env.openRouterApiKey) {
    headers.Authorization = `Bearer ${env.openRouterApiKey}`;
  }

  const response = await fetch(MODELS_URL, { headers });
  if (!response.ok) {
    throw new Error(`OpenRouter models API error ${response.status}`);
  }

  const body = (await response.json()) as { data?: Record<string, unknown>[] };
  const list = body.data ?? [];
  const models = new Map<string, OpenRouterModelPricing>();

  for (const raw of list) {
    const model = normalizeModel(raw);
    if (model) models.set(model.id, model);
  }

  return models;
}

export async function getOpenRouterCatalog(): Promise<Map<string, OpenRouterModelPricing>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_MS) {
    return cache.models;
  }

  try {
    const models = await fetchOpenRouterCatalog();
    cache = { fetchedAt: now, models };
    return models;
  } catch (err) {
    console.warn('[ai-estimate] OpenRouter catalog unavailable, using fallback pricing:', err);
    if (cache) return cache.models;
    return new Map();
  }
}

export function getCatalogFetchedAt(): string {
  return cache ? new Date(cache.fetchedAt).toISOString() : new Date().toISOString();
}

export function clearCatalogCache(): void {
  cache = null;
}

export async function getModelFromCatalog(
  modelId: string
): Promise<OpenRouterModelPricing | null> {
  const catalog = await getOpenRouterCatalog();
  return catalog.get(modelId) ?? null;
}

/** Fallback when catalog fetch fails or model missing from API */
export function fallbackPricing(modelId: string): OpenRouterModelPricing {
  const defaults: Record<string, { p: number; c: number }> = {
    'qwen/qwen3.5-flash-02-23': { p: 0.065 / 1_000_000, c: 0.26 / 1_000_000 },
    'deepseek/deepseek-v4-flash': { p: 0.0983 / 1_000_000, c: 0.1966 / 1_000_000 },
    'google/gemini-2.5-flash': { p: 0.3 / 1_000_000, c: 2.5 / 1_000_000 },
    'google/gemini-2.0-flash-001': { p: 0.3 / 1_000_000, c: 2.5 / 1_000_000 },
    'deepseek/deepseek-chat-v3-0324': { p: 0.2 / 1_000_000, c: 0.77 / 1_000_000 },
  };
  const d = defaults[modelId] ?? { p: 0.15 / 1_000_000, c: 0.5 / 1_000_000 };
  return {
    id: modelId,
    name: modelId.split('/').pop() ?? modelId,
    promptPerToken: d.p,
    completionPerToken: d.c,
  };
}
