import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  issueDemoToken,
  validateDemoCredentials,
  verifyDemoToken,
  isDemoAuthEnabled,
} from '../demoAuthService.js';

describe('demoAuthService', () => {
  const prevUser = process.env.DEMO_AUTH_USER;
  const prevPass = process.env.DEMO_AUTH_PASSWORD;

  beforeEach(() => {
    process.env.DEMO_AUTH_USER = 'demo';
    process.env.DEMO_AUTH_PASSWORD = 'secret';
    process.env.DEMO_AUTH_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.DEMO_AUTH_USER = prevUser;
    process.env.DEMO_AUTH_PASSWORD = prevPass;
  });

  it('validates credentials and issues verifiable token', () => {
    expect(isDemoAuthEnabled()).toBe(true);
    expect(validateDemoCredentials('demo', 'secret')).toBe(true);
    expect(validateDemoCredentials('demo', 'wrong')).toBe(false);
    const token = issueDemoToken();
    expect(verifyDemoToken(token)).toBe(true);
    expect(verifyDemoToken('bad.token')).toBe(false);
  });
});
