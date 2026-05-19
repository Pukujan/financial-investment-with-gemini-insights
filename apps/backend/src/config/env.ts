import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../../.env') });
config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  /** Demo gate — set both to require login before any /api call (except health + auth). */
  demoAuthUser: process.env.DEMO_AUTH_USER ?? '',
  demoAuthPassword: process.env.DEMO_AUTH_PASSWORD ?? '',
  demoAuthSecret:
    process.env.DEMO_AUTH_SECRET ??
    process.env.DEMO_AUTH_PASSWORD ??
    'change-me-demo-auth-secret',
  /**
   * Live quotes: `yahoo` (default, yahoo-finance2 / yfinance-style) | `tiingo` (API key).
   */
  marketLiveProvider: (() => {
    const p = (process.env.MARKET_LIVE_PROVIDER ?? 'yahoo').toLowerCase();
    return p === 'tiingo' ? ('tiingo' as const) : ('yahoo' as const);
  })(),
  appVersion: process.env.npm_package_version ?? '1.0.0',
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  /** Primary — DeepSeek V3 (~$0.20/$0.77 per 1M tokens on OpenRouter) */
  openRouterModelPrimary:
    process.env.OPENROUTER_MODEL_PRIMARY ?? 'deepseek/deepseek-chat-v3-0324',
  /** Fallback — Qwen 3.5 Flash (~$0.065/$0.26 per 1M) when primary fails */
  openRouterModelFallback:
    process.env.OPENROUTER_MODEL_FALLBACK ?? 'qwen/qwen3.5-flash-02-23',
  /** Max symbols to fetch live (default 100; set 0 for full catalog) */
  stockFetchLimit: parseInt(process.env.STOCK_FETCH_LIMIT ?? '100', 10),
  /** Default market mode: `live` | `mock` | `agent`. Overridable via API toggle. */
  marketDataMode: (() => {
    const mode = process.env.MARKET_DATA_MODE;
    if (mode === 'mock') return 'mock' as const;
    if (mode === 'agent') return 'agent' as const;
    return 'live' as const;
  })(),
  /** How long to reuse live quotes/news before refetching (default 12h). */
  marketCacheTtlHours: Math.max(
    1,
    parseFloat(process.env.MARKET_CACHE_TTL_HOURS ?? '12') || 12
  ),
  /** EOD quotes, charts, and news — https://www.tiingo.com */
  tiingoApiToken: process.env.TIINGO_API_TOKEN ?? '',
  tiingoBatchSize: Math.max(1, parseInt(process.env.TIINGO_BATCH_SIZE ?? '5', 10)),
  tiingoBatchDelayMs: Math.max(0, parseInt(process.env.TIINGO_BATCH_DELAY_MS ?? '500', 10)),
  /** Articles per daily news fetch (single API call, then cached). */
  tiingoNewsLimit: Math.max(10, parseInt(process.env.TIINGO_NEWS_LIMIT ?? '50', 10)),
  /**
   * If false (default), charts are served only from the daily bulk preload (0 extra API calls per click).
   * Set true only for debugging — each chart click costs another Tiingo request.
   */
  tiingoChartOnDemand: process.env.TIINGO_CHART_ON_DEMAND === 'true',
  /** Agent mode — max symbols to scrape (default 20) */
  agentScrapeSymbolLimit: Math.max(
    1,
    parseInt(process.env.AGENT_SCRAPE_SYMBOL_LIMIT ?? '20', 10)
  ),
  /** Agent scrape — symbols per LLM request */
  agentScrapeBatchSize: Math.max(1, parseInt(process.env.AGENT_SCRAPE_BATCH_SIZE ?? '5', 10)),
  /** Chart scrape — symbols per LLM request (default 1 to avoid truncated JSON) */
  agentScrapeChartBatchSize: Math.max(
    1,
    parseInt(process.env.AGENT_SCRAPE_CHART_BATCH_SIZE ?? '1', 10)
  ),
  agentScrapeBatchDelayMs: Math.max(
    0,
    parseInt(process.env.AGENT_SCRAPE_BATCH_DELAY_MS ?? '300', 10)
  ),
  /** Per OpenRouter call (single batch or news) */
  agentScrapeBatchTimeoutMs: Math.max(
    5_000,
    parseInt(process.env.AGENT_SCRAPE_BATCH_TIMEOUT_MS ?? '90000', 10)
  ),
  /** Whole scrape job wall-clock limit */
  agentScrapeJobTimeoutMs: Math.max(
    30_000,
    parseInt(process.env.AGENT_SCRAPE_JOB_TIMEOUT_MS ?? '300000', 10)
  ),
  /** Retries per batch (0 = one attempt only; capped to prevent loops) */
  agentScrapeMaxBatchRetries: Math.min(
    2,
    Math.max(0, parseInt(process.env.AGENT_SCRAPE_MAX_BATCH_RETRIES ?? '1', 10))
  ),
  /** Inject RAG catalog/news context into chart (and quote) scrape prompts. */
  agentScrapeRagEnabled: process.env.AGENT_SCRAPE_RAG !== 'false',
  /** Agent scrape + eval “primary” tier (defaults to OpenRouter primary) */
  agentModelStrong:
    process.env.AGENT_MODEL_STRONG ??
    process.env.OPENROUTER_MODEL_PRIMARY ??
    'deepseek/deepseek-chat-v3-0324',
  /** Agent eval “economy” tier — still paid; defaults to OpenRouter fallback */
  agentModelWeak:
    process.env.AGENT_MODEL_WEAK ??
    process.env.OPENROUTER_MODEL_FALLBACK ??
    'qwen/qwen3.5-flash-02-23',
  /** AI cost tiers for estimates + agent scrape (all paid, cheapest → best of three) */
  aiTierCheapest:
    process.env.AI_TIER_CHEAPEST ?? 'qwen/qwen3.5-flash-02-23',
  aiTierCheaper:
    process.env.AI_TIER_CHEAPER ?? 'google/gemini-2.0-flash-001',
  aiTierCheap:
    process.env.AI_TIER_CHEAP ?? 'deepseek/deepseek-chat-v3-0324',
  firebaseAppInstanceId: process.env.FIREBASE_APP_INSTANCE_ID ?? 'financial-app',
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY ?? '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.FIREBASE_APP_ID ?? '',
  },
  isFirebaseConfigured(): boolean {
    return Boolean(
      this.firebase.apiKey && this.firebase.projectId && this.firebase.appId
    );
  },
  isOpenRouterConfigured(): boolean {
    return Boolean(this.openRouterApiKey);
  },
  isTiingoConfigured(): boolean {
    return Boolean(this.tiingoApiToken);
  },
};

export function getPortfolioDocId(): string {
  return `${env.firebaseAppInstanceId}_user_portfolio`;
}

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!env.openRouterApiKey) {
    missing.push('OPENROUTER_API_KEY');
  } else if (!env.openRouterApiKey.startsWith('sk-or-')) {
    warnings.push('OPENROUTER_API_KEY should usually start with sk-or-');
  }

  if (!env.isFirebaseConfigured()) {
    warnings.push(
      'Firebase not fully configured — portfolio/AI cache will run in-memory only'
    );
  }

  if (env.marketDataMode === 'live' && env.marketLiveProvider === 'tiingo' && !env.isTiingoConfigured()) {
    warnings.push(
      'MARKET_DATA_MODE=live with MARKET_LIVE_PROVIDER=tiingo but TIINGO_API_TOKEN is not set'
    );
  }

  if (env.marketDataMode === 'live' && env.marketLiveProvider === 'yahoo') {
    warnings.push(
      'Live mode uses Yahoo Finance via yahoo-finance2 (same source as yfinance; no API key). News uses demo catalog.'
    );
  }

  if (env.marketDataMode === 'live' && env.isTiingoConfigured()) {
    warnings.push(
      'Tiingo News API may require a paid plan; free tokens usually include EOD prices only (news falls back to catalog)'
    );
  }

  if (env.marketDataMode === 'agent' && !env.isOpenRouterConfigured()) {
    warnings.push('MARKET_DATA_MODE=agent but OPENROUTER_API_KEY is not set — agent scrape will fail');
  }

  for (const [label, model] of [
    ['OPENROUTER_MODEL_PRIMARY', env.openRouterModelPrimary],
    ['OPENROUTER_MODEL_FALLBACK', env.openRouterModelFallback],
  ] as const) {
    if (model.includes(':free')) {
      warnings.push(
        `${label} uses a :free model (${model}) — free tiers are unreliable; use paid models in .env`
      );
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}
