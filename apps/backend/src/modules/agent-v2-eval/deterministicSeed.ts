/** Deterministic helpers — no Math.random. */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededUnit(seed: string): number {
  const h = hashString(seed);
  return (h % 10_000) / 10_000;
}

export function seededIndex(seed: string, max: number): number {
  if (max <= 0) return 0;
  return hashString(seed) % max;
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}
