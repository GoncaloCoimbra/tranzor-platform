import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const redisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  reconnectOnError: () => false,
};

export async function publishPortfolioEvent(channel: string, payload: string): Promise<void> {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_REDIS === 'true') {
    return;
  }

  const redis = new Redis(REDIS_URL, redisOptions);
  redis.on('error', (error) => console.error('[chatops] Redis publish connection error:', error));

  try {
    await redis.connect();
    await redis.publish(channel, payload);
  } finally {
    redis.disconnect();
  }
}

export async function checkRedisConnection(): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) throw new Error('REDIS_URL is not configured');

  const redis = new Redis(redisUrl, redisOptions);
  redis.on('error', (error) => console.error('[chatops] Redis startup probe error:', error));
  try {
    await redis.connect();
    if (await redis.ping() !== 'PONG') {
      throw new Error('Redis startup ping returned an unexpected response');
    }
  } finally {
    redis.disconnect();
  }
}

export default publishPortfolioEvent;
