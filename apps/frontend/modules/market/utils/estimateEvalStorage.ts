import type { AgentEstimateEvalRecord, AgentEstimateEvalHistory } from '@investai/shared';
import { buildEstimateEvalFromJob, summarizeEstimateEvals } from '@investai/shared';
import {
  appendCompletedEvalToQueue,
  loadAgentQueuePrefs,
  loadCompletedEvalsFromQueue,
} from '../../agent-queue/utils/agentQueueStorage';

const STORAGE_KEY = 'investai-estimate-eval-v1';
const MAX_LOCAL = 50;

export function loadLocalEstimateEvals(): AgentEstimateEvalRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentEstimateEvalRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistEstimateEvalRecord(record: AgentEstimateEvalRecord): void {
  try {
    const existing = loadLocalEstimateEvals();
    const byId = new Map(existing.map(r => [r.jobId, r]));
    byId.set(record.jobId, record);
    const next = [...byId.values()]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, MAX_LOCAL);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    appendCompletedEvalToQueue(record);
  } catch {
    /* quota / private mode */
  }
}

/** Merge dedicated eval storage, queue prefs, and last completed job snapshot. */
export function collectAllLocalEstimateEvals(): AgentEstimateEvalRecord[] {
  const byId = new Map<string, AgentEstimateEvalRecord>();
  for (const r of loadLocalEstimateEvals()) {
    byId.set(r.jobId, r);
  }
  for (const r of loadCompletedEvalsFromQueue()) {
    byId.set(r.jobId, r);
  }
  const lastJob = loadAgentQueuePrefs().lastJob;
  const backfill = lastJob ? buildEstimateEvalFromJob(lastJob) : null;
  if (backfill) {
    byId.set(backfill.jobId, backfill);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}

export function mergeEstimateEvalHistory(
  apiRecords: AgentEstimateEvalRecord[],
  localRecords: AgentEstimateEvalRecord[]
): AgentEstimateEvalHistory {
  const byId = new Map<string, AgentEstimateEvalRecord>();
  for (const r of [...apiRecords, ...localRecords]) {
    byId.set(r.jobId, r);
  }
  const records = [...byId.values()]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, MAX_LOCAL);
  return {
    records,
    summary: summarizeEstimateEvals(records),
  };
}
