import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';

describe('Health Controller', () => {
  const app = createApp();

  it('GET /api/health returns 200 with status payload', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toMatch(/ok|degraded/);
    expect(res.body.data.checks).toBeDefined();
    expect(res.body.data.timestamp).toBeDefined();
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('GET /api/qa/health mirrors health endpoint', async () => {
    const res = await request(app).get('/api/qa/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBeDefined();
  });
});
