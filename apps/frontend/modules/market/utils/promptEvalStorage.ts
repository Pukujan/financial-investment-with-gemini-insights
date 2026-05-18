import type { PromptEvalExperiment, PromptEvalHistory } from '@investai/shared';

const STORAGE_KEY = 'investai-prompt-eval-v1';
const MAX_LOCAL = 30;

export function loadLocalPromptEvals(): PromptEvalExperiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PromptEvalExperiment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPromptEvalExperiment(record: PromptEvalExperiment): void {
  try {
    const byId = new Map(loadLocalPromptEvals().map(r => [r.id, r]));
    byId.set(record.id, record);
    const next = [...byId.values()]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, MAX_LOCAL);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function mergePromptEvalHistory(
  apiRecords: PromptEvalExperiment[],
  localRecords: PromptEvalExperiment[]
): PromptEvalHistory {
  const byId = new Map<string, PromptEvalExperiment>();
  for (const r of [...apiRecords, ...localRecords]) {
    byId.set(r.id, r);
  }
  const records = [...byId.values()].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  return { records, lastRecord: records[0] ?? null };
}
