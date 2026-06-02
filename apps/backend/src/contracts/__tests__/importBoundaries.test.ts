import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  MOCK_PRICE_IMPORT_ALLOWLIST,
  MOCK_PRICE_IMPORT_PATTERNS,
} from '../importAllowlist.js';

const backendSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function listTsFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) listTsFiles(full, acc);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

/** Relative to `apps/backend/`. */
function rel(p: string): string {
  return path.relative(path.join(backendSrc, '..'), p).replace(/\\/g, '/');
}

describe('import boundaries — mock price data', () => {
  it('only allowlisted files import mockData/mockMarketData', () => {
    const violations: string[] = [];
    const allow = new Set(MOCK_PRICE_IMPORT_ALLOWLIST);

    for (const file of listTsFiles(backendSrc)) {
      const r = rel(file);
      if (r.includes('/__tests__/')) continue;
      const content = readFileSync(file, 'utf8');
      const hits = MOCK_PRICE_IMPORT_PATTERNS.some(p => p.test(content));
      if (hits && !allow.has(r)) {
        violations.push(r);
      }
    }

    expect(violations).toEqual([]);
  });
});
