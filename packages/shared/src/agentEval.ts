/** Strong vs weaker cheap models used in golden eval runs */
export type AgentEvalTier = 'strong' | 'weak';

export interface AgentGoldenPriceBand {
  min: number;
  max: number;
}

export interface AgentGoldenQuoteExpectation {
  symbol: string;
  price?: AgentGoldenPriceBand;
  requiredFields?: string[];
}

export interface AgentGoldenNewsExpectation {
  minArticles?: number;
  requiredFields?: string[];
  titleContains?: string;
}

export interface AgentGoldenCase {
  id: string;
  description: string;
  kind: 'quotes' | 'news';
  input: {
    symbols?: string[];
    newsTopics?: string[];
  };
  expected: {
    quotes?: AgentGoldenQuoteExpectation[];
    minQuoteCount?: number;
    news?: AgentGoldenNewsExpectation;
  };
}

export interface AgentEvalCaseResult {
  caseId: string;
  tier: AgentEvalTier;
  model: string;
  passed: boolean;
  score: number;
  maxScore: number;
  durationMs: number;
  failures: string[];
  warnings: string[];
}

export interface AgentEvalReport {
  ranAt: string;
  strongModel: string;
  weakModel: string;
  cases: AgentGoldenCase[];
  results: AgentEvalCaseResult[];
  summary: {
    strongPassRate: number;
    weakPassRate: number;
    strongAvgScore: number;
    weakAvgScore: number;
  };
}
