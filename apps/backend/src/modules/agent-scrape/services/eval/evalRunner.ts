import type { AgentEvalReport, AgentEvalTier, AgentGoldenCase } from '@investai/shared';
import { env } from '../../../../config/env.js';
import { scrapeNewsWithAgent } from '../agents/newsScrapeAgent.js';
import { scrapeQuotesWithAgent } from '../agents/quoteScrapeAgent.js';
import {
  scoreNewsAgainstGolden,
  scoreQuotesAgainstGolden,
  toCaseResult,
} from './goldenMatcher.js';
import { loadGoldenCases } from './goldenLoader.js';

let lastReport: AgentEvalReport | null = null;

function modelForTier(tier: AgentEvalTier): string {
  return tier === 'strong' ? env.agentModelStrong : env.agentModelWeak;
}

async function runCaseForTier(
  golden: AgentGoldenCase,
  tier: AgentEvalTier
): Promise<ReturnType<typeof toCaseResult>> {
  const model = modelForTier(tier);
  const start = Date.now();

  try {
    if (golden.kind === 'quotes') {
      const symbols = golden.input.symbols ?? [];
      const { quotes } = await scrapeQuotesWithAgent(symbols);
      const match = scoreQuotesAgainstGolden(quotes, golden);
      return toCaseResult(golden.id, tier, model, match, Date.now() - start);
    }

    const topics = golden.input.newsTopics ?? ['US stock market'];
    const { articles } = await scrapeNewsWithAgent(topics, 5);
    const match = scoreNewsAgainstGolden(articles, golden);
    return toCaseResult(golden.id, tier, model, match, Date.now() - start);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown eval error';
    return toCaseResult(
      golden.id,
      tier,
      model,
      {
        passed: false,
        score: 0,
        maxScore: 1,
        failures: [message],
        warnings: [],
      },
      Date.now() - start
    );
  }
}

function summarizeTier(
  results: AgentEvalReport['results'],
  tier: AgentEvalTier
): { passRate: number; avgScore: number } {
  const tierResults = results.filter(r => r.tier === tier);
  if (tierResults.length === 0) return { passRate: 0, avgScore: 0 };
  const passed = tierResults.filter(r => r.passed).length;
  const avgScore =
    tierResults.reduce((sum, r) => sum + r.score / Math.max(r.maxScore, 1), 0) /
    tierResults.length;
  return { passRate: passed / tierResults.length, avgScore };
}

export async function runGoldenEval(cases?: AgentGoldenCase[]): Promise<AgentEvalReport> {
  const goldenCases = cases ?? loadGoldenCases();
  const results = [];

  for (const golden of goldenCases) {
    results.push(await runCaseForTier(golden, 'strong'));
    results.push(await runCaseForTier(golden, 'weak'));
  }

  const strong = summarizeTier(results, 'strong');
  const weak = summarizeTier(results, 'weak');

  const report: AgentEvalReport = {
    ranAt: new Date().toISOString(),
    strongModel: env.agentModelStrong,
    weakModel: env.agentModelWeak,
    cases: goldenCases,
    results,
    summary: {
      strongPassRate: strong.passRate,
      weakPassRate: weak.passRate,
      strongAvgScore: strong.avgScore,
      weakAvgScore: weak.avgScore,
    },
  };

  lastReport = report;
  return report;
}

export function getLastEvalReport(): AgentEvalReport | null {
  return lastReport;
}
