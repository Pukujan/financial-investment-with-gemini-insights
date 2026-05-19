import type { AgentChartEvalHistory, AgentChartEvalRecord } from '@investai/shared';
import { loadAgentQueuePrefs } from '../../agent-queue/utils/agentQueueStorage';

const STORAGE_KEY = 'investai-chart-eval-v1';
const MAX_LOCAL = 50;

export function loadLocalChartEvals(): AgentChartEvalRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentChartEvalRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistChartEvalRecord(record: AgentChartEvalRecord): void {
  try {
    const existing = loadLocalChartEvals();
    const byId = new Map(existing.map(r => [r.jobId, r]));
    byId.set(record.jobId, record);
    const next = [...byId.values()]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, MAX_LOCAL);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

/** Dedicated storage + last completed job snapshot. */
export function collectAllLocalChartEvals(): AgentChartEvalRecord[] {
  const byId = new Map<string, AgentChartEvalRecord>();
  for (const r of loadLocalChartEvals()) {
    byId.set(r.jobId, r);
  }
  const lastJob = loadAgentQueuePrefs().lastJob;
  if (lastJob?.chartEval) {
    byId.set(lastJob.chartEval.jobId, lastJob.chartEval);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
}

export function mergeChartEvalHistory(
  apiRecords: AgentChartEvalRecord[],
  localRecords: AgentChartEvalRecord[]
): AgentChartEvalHistory {
  const byId = new Map<string, AgentChartEvalRecord>();
  for (const r of [...apiRecords, ...localRecords]) {
    byId.set(r.jobId, r);
  }
  const records = [...byId.values()].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  return { records, lastRecord: records[0] ?? null };
}
