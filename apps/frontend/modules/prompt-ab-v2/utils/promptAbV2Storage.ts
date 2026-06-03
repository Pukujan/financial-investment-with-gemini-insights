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
  try {
    const byId = new Map(loadLocalPromptAbV2Tests().map(r => [r.id, r]));
    byId.set(record.id, record);
    const next = [...byId.values()]
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

/** Same contract as prompt-ab v1 — arrays in, merged history out. */
export function mergePromptAbV2History(
  apiRecords: PromptAbV2Experiment[],
  localRecords: PromptAbV2Experiment[]
): PromptAbV2History {
  const byId = new Map<string, PromptAbV2Experiment>();
  for (const r of [...apiRecords, ...localRecords]) {
    byId.set(r.id, r);
  }
  const records = [...byId.values()].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );
  return { records, lastRecord: records[0] ?? null };
}
