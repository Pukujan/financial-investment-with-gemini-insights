import fs from 'fs';
import path from 'path';

export function loadEvalHistoryFromDisk<T>(
  filePath: string,
  validate: (item: unknown) => item is T
): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validate);
  } catch {
    return [];
  }
}

export function persistEvalHistoryToDisk<T>(filePath: string, records: T[]): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[eval-disk] Could not persist ${filePath}:`, err);
  }
}
