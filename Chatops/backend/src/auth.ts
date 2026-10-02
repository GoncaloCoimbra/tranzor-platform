import crypto from 'crypto';

export function createSignedToken(userId: string, expiresInSeconds = 300): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + expiresInSeconds })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'change-me')
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

export function parseUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'change-me')
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; userId?: string; id?: string; exp?: number };
    if (typeof decodedPayload.exp === 'number' && decodedPayload.exp * 1000 <= Date.now()) {
      return null;
    }

    return decodedPayload.sub || decodedPayload.userId || decodedPayload.id || null;
  } catch {
    return null;
  }
}
