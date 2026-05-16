import { describe, expect, it } from 'vitest';
import { parseJsonFromText, salvageTruncatedJson, stripJsonFences } from '../aiClient.js';

describe('stripJsonFences', () => {
  it('removes json code fences', () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe('salvageTruncatedJson', () => {
  it('closes truncated arrays', () => {
    const broken = '{"bars":[["2026-01-01",1,2,3,4],["2026-01-02",1,2,3';
    const fixed = salvageTruncatedJson(broken);
    expect(fixed).toBeTruthy();
    const parsed = JSON.parse(fixed!) as { bars: unknown[] };
    expect(Array.isArray(parsed.bars)).toBe(true);
  });
});

describe('parseJsonFromText', () => {
  it('parses fenced minified chart payload', () => {
    const payload = parseJsonFromText<{ symbol: string; bars: unknown[] }>(
      '```json\n{"symbol":"AAPL","bars":[["2026-01-01",1,2,3,4]]}\n```'
    );
    expect(payload.symbol).toBe('AAPL');
    expect(payload.bars).toHaveLength(1);
  });
});
