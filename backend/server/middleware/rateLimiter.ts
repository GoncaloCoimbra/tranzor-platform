import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../utils/cache';
import { logger } from '../config/logger';
import { env } from '../config/env';

export function createAuthRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = `auth:rate:${String(ip)}`;
    const windowMs = 15 * 60 * 1000;
    const maxRequests = env.AUTH_RATE_LIMIT_MAX_REQUESTS;

    try {
      const client = await getRedisClient();
      if (!client) {
        return next();
      }

      const count = await client.incr(key);
      if (count === 1) {
        await client.pexpire(key, windowMs);
      }

      if (count > maxRequests) {
        logger.warn(`Auth rate limit exceeded for ${key}`);
        return res.status(429).json({
          success: false,
          error: 'Muitas tentativas de autenticação. Tente novamente mais tarde.',
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
        });
      }
    } catch (error) {
      logger.warn('Redis auth rate limiter failed, falling back to default policy', { error });
    }

    next();
  };
}
