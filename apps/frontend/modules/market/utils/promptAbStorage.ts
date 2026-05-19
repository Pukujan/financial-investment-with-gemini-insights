import type { PromptAbTestExperiment, PromptAbTestHistory } from '@investai/shared';

const STORAGE_KEY = 'investai-prompt-ab-v1';
const MAX_LOCAL = 30;

export function loadLocalPromptAbTests(): PromptAbTestExperiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PromptAbTestExperiment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPromptAbExperiment(record: PromptAbTestExperiment): void {
  try {
    const byId = new Map(loadLocalPromptAbTests().map(r => [r.id, r]));
    byId.set(record.id, record);
    const next = [...byId.values()]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, MAX_LOCAL);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function mergePromptAbHistory(
  apiRecords: PromptAbTestExperiment[],
  localRecords: PromptAbTestExperiment[]
): PromptAbTestHistory {
  const byId = new Map<string, PromptAbTestExperiment>();
  for (const r of [...apiRecords, ...localRecords]) {
    byId.set(r.id, r);
  }
  const records = [...byId.values()].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  return { records, lastRecord: records[0] ?? null };
}
