import crypto from 'crypto';
import { createSignedToken as issueSignedToken, parseUserIdFromToken } from '../src/auth';

describe('parseUserIdFromToken', () => {
  const secret = 'test-secret';

  function createSignedToken(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  it('returns the user id for a valid signed token', () => {
    process.env.JWT_SECRET = secret;
    const token = createSignedToken({ sub: 'user-123' });

    expect(parseUserIdFromToken(`Bearer ${token}`)).toBe('user-123');
  });

  it('creates a signed token accepted by the parser', () => {
    process.env.JWT_SECRET = secret;

    expect(parseUserIdFromToken(`Bearer ${issueSignedToken('user-123')}`)).toBe('user-123');
  });

  it('rejects a token with an invalid signature', () => {
    process.env.JWT_SECRET = secret;
    const token = createSignedToken({ sub: 'user-123' }).slice(0, -1) + 'x';

    expect(parseUserIdFromToken(`Bearer ${token}`)).toBeNull();
  });

  it('rejects an expired token', () => {
    process.env.JWT_SECRET = secret;
    const token = createSignedToken({ sub: 'user-123', exp: Math.floor(Date.now() / 1000) - 60 });

    expect(parseUserIdFromToken(`Bearer ${token}`)).toBeNull();
  });

  it('returns null when no bearer token is provided', () => {
    expect(parseUserIdFromToken(undefined)).toBeNull();
  });
});
