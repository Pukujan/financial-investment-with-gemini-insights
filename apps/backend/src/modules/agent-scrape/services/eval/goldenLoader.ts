import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AgentGoldenCase } from '@investai/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.resolve(__dirname, '../../golden');

export function loadGoldenCases(): AgentGoldenCase[] {
  const files = readdirSync(GOLDEN_DIR).filter(f => f.endsWith('.json'));
  return files.map(file => {
    const raw = readFileSync(path.join(GOLDEN_DIR, file), 'utf-8');
    return JSON.parse(raw) as AgentGoldenCase;
  });
}

export function loadGoldenCaseById(id: string): AgentGoldenCase | undefined {
  return loadGoldenCases().find(c => c.id === id);
}
