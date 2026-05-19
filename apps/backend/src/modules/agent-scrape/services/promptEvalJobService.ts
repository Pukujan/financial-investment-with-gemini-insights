import { randomUUID } from 'crypto';
import type {
  PromptEvalGroundTruthPayload,
  PromptEvalJob,
  PromptEvalJobTierStep,
} from '@investai/shared';
import { AI_COST_TIER_LABELS, AI_COST_TIERS } from '@investai/shared';
import type { Request } from 'express';
import {
  assertPromptEvalCooldown,
  recordPromptEvalCooldownRun,
} from './promptEvalCooldown.js';
import { runPromptEvalWithProgress, type PromptEvalProgressHooks } from './promptEvalService.js';

const jobs = new Map<string, PromptEvalJob>();
const jobGroundTruth = new Map<string, PromptEvalGroundTruthPayload>();
let activeJobId: string | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function touch(job: PromptEvalJob): void {
  job.updatedAt = nowIso();
}

function initialTierSteps(): PromptEvalJobTierStep[] {
  return AI_COST_TIERS.map(tier => ({
    tier,
    label: AI_COST_TIER_LABELS[tier],
    status: 'pending',
    progress: 0,
  }));
}

export function getPromptEvalJob(jobId: string): PromptEvalJob | null {
  return jobs.get(jobId) ?? null;
}

export function getActivePromptEvalJob(): PromptEvalJob | null {
  if (!activeJobId) return null;
  return getPromptEvalJob(activeJobId);
}

export function createPromptEvalJob(options: {
  promptVersion: string;
  ragEnabled?: boolean;
  symbolLimit?: number;
  groundTruth?: PromptEvalGroundTruthPayload;
}): PromptEvalJob {
  if (activeJobId) {
    const existing = jobs.get(activeJobId);
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      throw new Error('A prompt eval test is already running');
    }
  }

  const ragEnabled = options.ragEnabled === true;
  const setupSteps = [
    {
      id: 'ground-truth',
      label: 'Load reference EOD (cache / Yahoo)',
      status: 'pending' as const,
    },
    ...(ragEnabled
      ? [{ id: 'rag', label: 'RAG retrieval', status: 'pending' as const }]
      : []),
  ];

  const job: PromptEvalJob = {
    id: randomUUID(),
    status: 'queued',
    promptVersion: options.promptVersion,
    ragEnabled,
    symbolLimit: options.symbolLimit,
    phaseLabel: 'Queued',
    progress: { completed: 0, total: setupSteps.length + AI_COST_TIERS.length },
    setupSteps,
    tiers: initialTierSteps(),
    startedAt: nowIso(),
    updatedAt: nowIso(),
  };

  jobs.set(job.id, job);
  if (options.groundTruth) jobGroundTruth.set(job.id, options.groundTruth);
  return job;
}

function buildHooks(job: PromptEvalJob): PromptEvalProgressHooks {
  const tierIndex = (tier: PromptEvalJobTierStep['tier']) =>
    job.tiers.findIndex(t => t.tier === tier);

  return {
    onSetupStart: (id, label) => {
      job.phaseLabel = label;
      const step = job.setupSteps.find(s => s.id === id);
      if (step) step.status = 'running';
      touch(job);
    },
    onSetupDone: (id, detail) => {
      const step = job.setupSteps.find(s => s.id === id);
      if (step) {
        step.status = 'done';
        if (detail) step.detail = detail;
      }
      job.progress.completed += 1;
      touch(job);
    },
    onTierStart: (tier, modelId) => {
      const i = tierIndex(tier);
      if (i < 0) return;
      job.phaseLabel = `${AI_COST_TIER_LABELS[tier]} tier`;
      job.tiers[i] = {
        ...job.tiers[i],
        status: 'running',
        progress: 15,
        modelId,
        reasoning: 'Calling OpenRouter…',
        error: undefined,
      };
      touch(job);
    },
    onTierReasoning: (tier, reasoning) => {
      const i = tierIndex(tier);
      if (i < 0) return;
      job.tiers[i] = { ...job.tiers[i], progress: 85, reasoning };
      touch(job);
    },
    onTierDone: (tier, result) => {
      const i = tierIndex(tier);
      if (i < 0) return;
      job.tiers[i] = {
        ...job.tiers[i],
        status: 'done',
        progress: 100,
        modelId: result.modelId,
        reasoning: result.reasoning ?? job.tiers[i].reasoning,
        tokensUsed: result.tokensUsed,
        avgQuoteDeviationPct: result.avgAbsQuoteDeviationPct,
      };
      job.progress.completed += 1;
      touch(job);
    },
    onTierFailed: (tier, message) => {
      const i = tierIndex(tier);
      if (i < 0) return;
      job.tiers[i] = {
        ...job.tiers[i],
        status: 'failed',
        progress: 100,
        error: message,
        reasoning: undefined,
      };
      job.progress.completed += 1;
      touch(job);
    },
  };
}

async function runPromptEvalJob(jobId: string, req: Request): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'queued') return;

  activeJobId = jobId;
  job.status = 'running';
  job.phaseLabel = 'Starting…';
  touch(job);

  try {
    assertPromptEvalCooldown(req);
    const { experiment, summary } = await runPromptEvalWithProgress(
      {
        promptVersion: job.promptVersion,
        ragEnabled: job.ragEnabled,
        symbolLimit: job.symbolLimit,
        experimentId: job.id,
        groundTruth: jobGroundTruth.get(jobId),
      },
      buildHooks(job)
    );
    recordPromptEvalCooldownRun(req);

    job.status = 'completed';
    job.phaseLabel = 'Complete';
    job.experiment = experiment;
    job.summary = summary;
    job.completedAt = nowIso();
    touch(job);
  } catch (err) {
    job.status = 'failed';
    job.phaseLabel = 'Failed';
    job.error = err instanceof Error ? err.message : 'Prompt eval failed';
    job.completedAt = nowIso();
    touch(job);
  } finally {
    jobGroundTruth.delete(jobId);
    if (activeJobId === jobId) activeJobId = null;
  }
}

export function startPromptEvalJob(jobId: string, req: Request): void {
  void runPromptEvalJob(jobId, req);
}

export function prunePromptEvalJobs(): void {
  if (jobs.size <= 8) return;
  const sorted = [...jobs.entries()].sort(
    (a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime()
  );
  for (const [id] of sorted.slice(8)) {
    if (id !== activeJobId) jobs.delete(id);
  }
}
