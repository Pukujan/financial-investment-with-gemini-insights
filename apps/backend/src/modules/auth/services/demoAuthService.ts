import crypto from 'crypto';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function demoUser(): string {
  return process.env.DEMO_AUTH_USER ?? '';
}

function demoPassword(): string {
  return process.env.DEMO_AUTH_PASSWORD ?? '';
}

function demoSecret(): string {
  return process.env.DEMO_AUTH_SECRET ?? process.env.DEMO_AUTH_PASSWORD ?? 'change-me-demo-auth-secret';
}

export function isDemoAuthEnabled(): boolean {
  return Boolean(demoUser() && demoPassword());
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function validateDemoCredentials(username: string, password: string): boolean {
  if (!isDemoAuthEnabled()) return false;
  return safeEqual(username, demoUser()) && safeEqual(password, demoPassword());
}

function signPayload(encoded: string): string {
  return crypto.createHmac('sha256', demoSecret()).update(encoded).digest('base64url');
}

export function issueDemoToken(): string {
  const payload = {
    sub: demoUser(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signPayload(encoded)}`;
}

export function verifyDemoToken(token: string | undefined): boolean {
  if (!isDemoAuthEnabled() || !token) return false;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return false;

  const expected = signPayload(encoded);
  try {
    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}
