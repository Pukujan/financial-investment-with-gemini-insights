import type { AiCostTier } from './aiEstimate.js';

export interface AgentDataSourcesInfo {
  configured: boolean;
  symbols: string[];
  symbolCount: number;
  symbolLimit: number;
  batchSize: number;
  catalog: {
    file: string;
    description: string;
  };
  quotes: {
    provider: string;
    url: string;
    method: string;
  };
  news: {
    provider: string;
    url: string;
    method: string;
  };
  charts: {
    method: string;
    note: string;
  };
  cache: {
    method: string;
  };
  tiers: { tier: AiCostTier; modelId: string }[];
}
