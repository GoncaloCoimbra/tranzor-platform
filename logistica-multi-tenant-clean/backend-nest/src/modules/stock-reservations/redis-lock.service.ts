import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private redisClient: Redis | null = null;

  async acquireLock(key: string): Promise<string | null> {
    const redis = await this.getRedisClient();

    if (!redis) {
      this.logger.warn(
        `Redis lock unavailable for key ${key}; rejecting reservation to fail safe.`,
      );
      return null;
    }

    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const result = await redis.set(key, token, 'EX', 5, 'NX');
      return result === 'OK' ? token : null;
    } catch (error) {
      this.logger.error(`Failed to acquire Redis lock for key ${key}`, error);
      return null;
    }
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const redis = await this.getRedisClient();

    if (!redis) {
      return false;
    }

    try {
      const result = await redis.eval(
        `
        if redis.call('get', KEYS[1]) == ARGV[1] then
          return redis.call('del', KEYS[1])
        end
        return 0
        `,
        1,
        key,
        token,
      );

      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to release Redis lock for key ${key}`, error);
      return false;
    }
  }

  private async getRedisClient(): Promise<Redis | null> {
    if (this.redisClient) {
      return this.redisClient;
    }

    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      return null;
    }

    if (this.redisClient) {
      return this.redisClient;
    }

    this.redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });

    this.redisClient.on('error', () => {
      // Swallow connection noise and let callers fail safely.
    });

    try {
      await this.redisClient.connect();
      return this.redisClient;
    } catch (error) {
      this.logger.warn(
        'Redis lock client could not connect; reservations will be rejected safely.',
      );
      this.redisClient = null;
      return null;
    }
  }
}
