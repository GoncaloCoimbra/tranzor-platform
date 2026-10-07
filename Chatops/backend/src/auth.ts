import crypto from 'crypto';

const DEVELOPMENT_JWT_SECRET = 'replace-with-a-secure-random-secret';

export interface CommerceIdentity {
  id: string;
  email: string;
  role: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const protectedEnvironment = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

  if (!protectedEnvironment) {
    return secret || DEVELOPMENT_JWT_SECRET;
  }

  if (!secret) {
    throw new Error('JWT_SECRET é obrigatória em produção e staging.');
  }
  if (
    secret.length < 32 ||
    /change-me|replace-with|local-dev|password|secret-key/i.test(secret)
  ) {
    throw new Error('JWT_SECRET tem de ter pelo menos 32 caracteres e não pode ser um valor de exemplo.');
  }

  return secret;
}

function decodeBase64UrlJson(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

export function verifyCommerceToken(token: string): CommerceIdentity | null {
  const secret = getJwtSecret();
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (parts.some((part) =>
    !/^[A-Za-z0-9_-]+$/.test(part) ||
    Buffer.from(part, 'base64url').toString('base64url') !== part
  )) return null;

  try {
    const header = decodeBase64UrlJson(encodedHeader) as { alg?: unknown; typ?: unknown };
    if (header.alg !== 'HS256' || (header.typ !== undefined && header.typ !== 'JWT')) return null;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const providedSignature = Buffer.from(encodedSignature, 'base64url');
    if (
      providedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(providedSignature, expectedSignature)
    ) {
      return null;
    }

    const payload = decodeBase64UrlJson(encodedPayload) as {
      id?: unknown;
      email?: unknown;
      role?: unknown;
      exp?: unknown;
      nbf?: unknown;
    };
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.id !== 'string' ||
      !payload.id ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= now ||
      (typeof payload.nbf === 'number' && payload.nbf > now)
    ) {
      return null;
    }

    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function parseUserIdFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return verifyCommerceToken(token)?.id ?? null;
}
