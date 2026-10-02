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
  redis.on('error', () => undefined);

  try {
    await redis.connect();
    await redis.publish(channel, payload);
  } finally {
    redis.disconnect();
  }
}

export default publishPortfolioEvent;
