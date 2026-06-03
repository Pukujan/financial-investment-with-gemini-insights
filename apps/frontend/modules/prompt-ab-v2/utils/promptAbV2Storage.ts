import type { PromptAbV2Experiment, PromptAbV2History } from '@investai/shared';

const STORAGE_KEY = 'investai-prompt-ab-v2-v1';

export function loadLocalPromptAbV2Tests(): PromptAbV2Experiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PromptAbV2Experiment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPromptAbV2Experiment(record: PromptAbV2Experiment): void {
  const existing = loadLocalPromptAbV2Tests();
  const next = [record, ...existing.filter(r => r.id !== record.id)].slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function mergePromptAbV2History(
  api: PromptAbV2History,
  local: PromptAbV2Experiment[]
): PromptAbV2History {
  const byId = new Map<string, PromptAbV2Experiment>();
  for (const r of [...api.records, ...local]) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const records = [...byId.values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return { records, lastRecord: records[0] ?? null };
}
