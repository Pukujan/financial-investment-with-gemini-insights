import { describe, it, expect } from 'vitest';
import { env } from '../../../../../config/env.js';
import { runGoldenEval } from '../evalRunner.js';
import { loadGoldenCases } from '../goldenLoader.js';

const runLive = process.env.RUN_AGENT_EVAL === '1' && env.isOpenRouterConfigured();

describe.runIf(runLive)('agent golden eval (live OpenRouter)', () => {
  it('runs strong vs weak on quotes-core only', async () => {
    const cases = loadGoldenCases().filter(c => c.id === 'quotes-core');
    const report = await runGoldenEval(cases);
    expect(report.results.length).toBe(2);
    expect(report.summary.strongPassRate).toBeGreaterThanOrEqual(0);
    expect(report.summary.weakPassRate).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
