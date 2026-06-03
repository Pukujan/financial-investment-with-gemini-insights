import { randomUUID } from 'crypto';
import type {
  AiCostTier,
  PromptAbV2CellResult,
  PromptAbV2Job,
  PromptAbV2PromptId,
  PromptAbV2QueueItem,
} from '@investai/shared';
import {
  AI_COST_TIERS,
  PROMPT_AB_V2_PROMPT_IDS,
  PROMPT_AB_V2_SYMBOLS,
} from '@investai/shared';
import type { Request } from 'express';
import {
  assertPromptEvalCooldown,
  recordPromptEvalCooldownRun,
} from '../agent-scrape/services/promptEvalCooldown.js';
import {
  runPromptAbV2TestWithProgress,
  type PromptAbV2ProgressHooks,
} from './promptAbV2TestService.js';

const jobs = new Map<string, PromptAbV2Job>();
let activeJobId: string | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function touch(job: PromptAbV2Job): void {
  job.updatedAt = nowIso();
}

function buildQueue(symbols: string[], promptIds: PromptAbV2PromptId[], tiers: AiCostTier[]): PromptAbV2QueueItem[] {
  const queue: PromptAbV2QueueItem[] = [];
  for (const symbol of symbols) {
    for (const promptId of promptIds) {
      for (const tier of tiers) {
        queue.push({
          id: `${symbol}:${promptId}:${tier}`,
          symbol,
          promptId,
          tier,
          status: 'pending',
        });
      }
    }
  }
  return queue;
}

function initialSteps(totalCells: number): PromptAbV2Job['steps'] {
  return [
    { id: 'yahoo', label: 'Fetch Yahoo 30-day charts', status: 'pending' },
    { id: 'news', label: 'Generate synthetic demo news', status: 'pending' },
    { id: 'matrix', label: `Hybrid LLM matrix (${totalCells} cells)`, status: 'pending' },
    { id: 'persist', label: 'Save run log', status: 'pending' },
  ];
}

export function getPromptAbV2Job(jobId: string): PromptAbV2Job | null {
  return jobs.get(jobId) ?? null;
}

export function getActivePromptAbV2Job(): PromptAbV2Job | null {
  if (!activeJobId) return null;
  return getPromptAbV2Job(activeJobId);
}

export function createPromptAbV2Job(options?: {
  symbols?: string[];
  promptIds?: PromptAbV2PromptId[];
  tiers?: AiCostTier[];
}): PromptAbV2Job {
  if (activeJobId) {
    const existing = jobs.get(activeJobId);
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      throw new Error('An Agent v2 A/B test is already running');
    }
  }

  const symbols = (options?.symbols ?? [...PROMPT_AB_V2_SYMBOLS]).map(s => s.toUpperCase());
  const promptIds = options?.promptIds ?? [...PROMPT_AB_V2_PROMPT_IDS];
  const tiers = options?.tiers ?? [...AI_COST_TIERS];
  const totalCells = symbols.length * promptIds.length * tiers.length;
  const steps = initialSteps(totalCells);

  const job: PromptAbV2Job = {
    id: randomUUID(),
    status: 'queued',
    symbols,
    promptIds,
    tiers,
    phaseLabel: 'Queued',
    progress: { completed: 0, total: totalCells },
    queue: buildQueue(symbols, promptIds, tiers),
    steps,
    startedAt: nowIso(),
    updatedAt: nowIso(),
  };

  jobs.set(job.id, job);
  return job;
}

function updateQueueItem(
  job: PromptAbV2Job,
  symbol: string,
  promptId: PromptAbV2PromptId,
  tier: AiCostTier,
  status: PromptAbV2QueueItem['status'],
  detail?: string
): void {
  const item = job.queue.find(
    q => q.symbol === symbol && q.promptId === promptId && q.tier === tier
  );
  if (item) {
    item.status = status;
    if (detail) item.detail = detail;
  }
}

function buildHooks(job: PromptAbV2Job): PromptAbV2ProgressHooks {
  let yahooDone = false;
  let newsDone = false;

  return {
    onPhase: label => {
      job.phaseLabel = label;
      if (label.includes('Yahoo') && !yahooDone) {
        const step = job.steps.find(s => s.id === 'yahoo');
        if (step) step.status = 'running';
        yahooDone = true;
      }
      if (label.includes('demo news') && !newsDone) {
        const yahooStep = job.steps.find(s => s.id === 'yahoo');
        if (yahooStep) yahooStep.status = 'done';
        const newsStep = job.steps.find(s => s.id === 'news');
        if (newsStep) newsStep.status = 'done';
        newsDone = true;
      }
      if (label.includes('matrix')) {
        const matrixStep = job.steps.find(s => s.id === 'matrix');
        if (matrixStep) matrixStep.status = 'running';
      }
      touch(job);
    },
    onCellStart: ({ symbol, promptId, tier }) => {
      job.phaseLabel = `${symbol} · ${promptId} · ${tier}`;
      updateQueueItem(job, symbol, promptId, tier, 'running');
      touch(job);
    },
    onCellDone: (cell: PromptAbV2CellResult) => {
      updateQueueItem(job, cell.symbol, cell.promptId, cell.tier, 'done');
      job.progress.completed += 1;
      touch(job);
    },
    onCellFailed: ({ symbol, promptId, tier }, message) => {
      updateQueueItem(job, symbol, promptId, tier, 'failed', message);
      touch(job);
    },
  };
}

export async function runPromptAbV2Job(jobId: string, req?: Request): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'queued') return;

  if (req) assertPromptEvalCooldown(req);

  activeJobId = jobId;
  job.status = 'running';
  job.phaseLabel = 'Starting…';
  touch(job);

  try {
    const { experiment, summary } = await runPromptAbV2TestWithProgress(
      {
        symbols: job.symbols,
        promptIds: job.promptIds,
        tiers: job.tiers,
      },
      buildHooks(job)
    );

    const matrixStep = job.steps.find(s => s.id === 'matrix');
    if (matrixStep) matrixStep.status = 'done';
    const persistStep = job.steps.find(s => s.id === 'persist');
    if (persistStep) persistStep.status = 'done';

    job.status = 'completed';
    job.phaseLabel = 'Completed';
    job.summary = summary;
    job.experiment = experiment;
    job.progress.completed = job.progress.total;
    touch(job);

    if (req) recordPromptEvalCooldownRun(req);
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : String(err);
    job.phaseLabel = 'Failed';
    const matrixStep = job.steps.find(s => s.id === 'matrix');
    if (matrixStep && matrixStep.status === 'running') matrixStep.status = 'failed';
    touch(job);
  } finally {
    if (activeJobId === jobId) activeJobId = null;
  }
}

export function startPromptAbV2Job(jobId: string, req?: Request): void {
  void runPromptAbV2Job(jobId, req);
}

export function prunePromptAbV2Jobs(max = 20): void {
  const entries = [...jobs.entries()].sort(
    (a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt)
  );
  for (const [id] of entries.slice(max)) {
    if (id !== activeJobId) jobs.delete(id);
  }
}
