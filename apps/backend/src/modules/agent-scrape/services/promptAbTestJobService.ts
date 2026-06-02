/** Pipeline contract: @see ../../workflows/prompt-ab.pipeline.ts (PROMPT_AB_PIPELINE) */
import { randomUUID } from 'crypto';
import type {
  AiCostTier,
  PromptAbTestJob,
  PromptAbTestJobStep,
  PromptEvalGroundTruthPayload,
} from '@investai/shared';
import { PROMPT_AB_VERSION_A_DEFAULT, PROMPT_AB_VERSION_B_DEFAULT } from '@investai/shared';
import type { Request } from 'express';
import {
  assertPromptEvalCooldown,
  recordPromptEvalCooldownRun,
} from './promptEvalCooldown.js';
import {
  estimatePromptAbForOptions,
  runPromptAbTestWithProgress,
  type PromptAbTestProgressHooks,
} from './promptAbTestService.js';

const jobs = new Map<string, PromptAbTestJob>();
const jobGroundTruth = new Map<string, PromptEvalGroundTruthPayload>();
let activeJobId: string | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function touch(job: PromptAbTestJob): void {
  job.updatedAt = nowIso();
}

function initialSteps(ragEnabled: boolean): PromptAbTestJobStep[] {
  return [
    { id: 'estimate', label: 'Token & cost estimate', status: 'pending' },
    { id: 'ground-truth', label: 'Load Live cached EOD ground truth', status: 'pending' },
    ...(ragEnabled ? [{ id: 'rag', label: 'RAG retrieval', status: 'pending' as const }] : []),
    { id: 'arm-a', label: 'Chart scrape arm A (30d EOD)', status: 'pending' },
    { id: 'arm-b', label: 'Chart scrape arm B (30d EOD)', status: 'pending' },
    { id: 'insight', label: 'AI engineering insight', status: 'pending' },
  ];
}

export function getPromptAbTestJob(jobId: string): PromptAbTestJob | null {
  return jobs.get(jobId) ?? null;
}

export function getActivePromptAbTestJob(): PromptAbTestJob | null {
  if (!activeJobId) return null;
  return getPromptAbTestJob(activeJobId);
}

export function createPromptAbTestJob(options: {
  versionA?: string;
  versionB?: string;
  tier?: AiCostTier;
  ragEnabled?: boolean;
  symbolLimit?: number;
  groundTruth?: PromptEvalGroundTruthPayload;
}): PromptAbTestJob {
  if (activeJobId) {
    const existing = jobs.get(activeJobId);
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      throw new Error('A prompt A/B test is already running');
    }
  }

  const ragEnabled = options.ragEnabled === true;
  const steps = initialSteps(ragEnabled);
  const job: PromptAbTestJob = {
    id: randomUUID(),
    status: 'queued',
    versionA: options.versionA ?? PROMPT_AB_VERSION_A_DEFAULT,
    versionB: options.versionB ?? PROMPT_AB_VERSION_B_DEFAULT,
    tier: options.tier ?? 'cheaper',
    ragEnabled,
    symbolLimit: options.symbolLimit,
    phaseLabel: 'Queued',
    progress: { completed: 0, total: steps.length },
    steps,
    startedAt: nowIso(),
    updatedAt: nowIso(),
  };

  jobs.set(job.id, job);
  if (options.groundTruth) jobGroundTruth.set(job.id, options.groundTruth);
  return job;
}

function buildHooks(job: PromptAbTestJob): PromptAbTestProgressHooks {
  return {
    onStepStart: (id, label) => {
      job.phaseLabel = label;
      const step = job.steps.find(s => s.id === id);
      if (step) step.status = 'running';
      touch(job);
    },
    onStepDone: (id, detail) => {
      const step = job.steps.find(s => s.id === id);
      if (step) {
        step.status = 'done';
        if (detail) step.detail = detail;
      }
      job.progress.completed += 1;
      touch(job);
    },
    onStepFailed: (id, message) => {
      const step = job.steps.find(s => s.id === id);
      if (step) {
        step.status = 'failed';
        step.detail = message;
      }
      touch(job);
    },
  };
}

export async function runPromptAbTestJob(jobId: string, req?: Request): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || job.status !== 'queued') return;

  activeJobId = jobId;
  job.status = 'running';
  touch(job);

  try {
    const groundTruth = jobGroundTruth.get(jobId);
    const estimateSnapshot = await estimatePromptAbForOptions({
      tier: job.tier,
      ragEnabled: job.ragEnabled,
      symbolLimit: job.symbolLimit,
    });
    job.estimateSnapshot = estimateSnapshot;

    const { experiment, summary } = await runPromptAbTestWithProgress(
      {
        versionA: job.versionA,
        versionB: job.versionB,
        tier: job.tier,
        ragEnabled: job.ragEnabled,
        symbolLimit: job.symbolLimit,
        experimentId: job.id,
        groundTruth,
        estimateSnapshot,
      },
      buildHooks(job)
    );

    job.status = 'completed';
    job.completedAt = nowIso();
    job.phaseLabel = 'Complete';
    job.experiment = experiment;
    job.summary = summary;
    if (req) recordPromptEvalCooldownRun(req);
    touch(job);
  } catch (err) {
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'A/B test failed';
    job.completedAt = nowIso();
    touch(job);
  } finally {
    jobGroundTruth.delete(jobId);
    if (activeJobId === jobId) activeJobId = null;
  }
}

export function startPromptAbTestJob(jobId: string, req?: Request): void {
  if (req) assertPromptEvalCooldown(req);
  void runPromptAbTestJob(jobId, req);
}

export function prunePromptAbTestJobs(): void {
  if (jobs.size <= 10) return;
  const sorted = [...jobs.entries()].sort(
    (a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime()
  );
  for (const [id] of sorted.slice(10)) {
    if (id !== activeJobId) jobs.delete(id);
  }
}
