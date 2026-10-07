import crypto from 'crypto';
import { parseUserIdFromToken, verifyCommerceToken } from '../src/auth';

describe('Commerce JWT validation', () => {
  const secret = 'test-secret';
  const validIdentity = {
    id: 'user-123',
    email: 'user@example.com',
    role: 'user',
  };

  function createCommerceToken(
    payload: Record<string, unknown> = {
      ...validIdentity,
      exp: Math.floor(Date.now() / 1000) + 300,
    },
    algorithm = 'HS256',
  ): string {
    const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = secret;
  });

  it('accepts a valid Commerce access token', () => {
    const token = createCommerceToken();
    expect(verifyCommerceToken(token)).toEqual(validIdentity);
    expect(parseUserIdFromToken(`Bearer ${token}`)).toBe(validIdentity.id);
  });

  it('rejects an invalid signature', () => {
    const token = createCommerceToken();
    const invalid = `${token.slice(0, -1)}x`;
    expect(verifyCommerceToken(invalid)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createCommerceToken({
      ...validIdentity,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect(verifyCommerceToken(token)).toBeNull();
  });

  it('rejects algorithms other than HS256', () => {
    expect(verifyCommerceToken(createCommerceToken(undefined, 'none'))).toBeNull();
  });

  it('rejects tokens that do not include the Commerce account claims', () => {
    expect(verifyCommerceToken(createCommerceToken({ sub: 'user-123', exp: Date.now() / 1000 + 300 }))).toBeNull();
  });

  it('returns null when no bearer token is provided', () => {
    expect(parseUserIdFromToken(undefined)).toBeNull();
  });
});
