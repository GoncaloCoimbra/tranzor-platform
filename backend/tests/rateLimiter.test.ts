import Redis from 'ioredis';
import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../server/config/env';
import { createAuthRateLimiter } from '../server/middleware/rateLimiter';
import { getRedisClient } from '../server/utils/cache';

jest.mock('../server/utils/cache', () => ({
  getRedisClient: jest.fn(),
}));

const redisClient = new Redis({ lazyConnect: true });
let requestCount = 0;

jest.spyOn(redisClient, 'incr').mockImplementation(async () => ++requestCount);
jest.spyOn(redisClient, 'pexpire').mockResolvedValue(1);

describe('authentication rate limiter', () => {
  beforeEach(() => {
    requestCount = 0;
    jest.mocked(getRedisClient).mockResolvedValue(redisClient);
  });

  afterAll(() => {
    redisClient.disconnect();
  });

  it('keeps the default five-request policy and returns 429 on the sixth request', async () => {
    expect(env.AUTH_RATE_LIMIT_MAX_REQUESTS).toBe(5);

    const limiter = createAuthRateLimiter();
    const req = { ip: '198.51.100.7', headers: {} } as Request;
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      json,
    } as unknown as Response;
    const next: NextFunction = jest.fn();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await limiter(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    }));
  });
});
