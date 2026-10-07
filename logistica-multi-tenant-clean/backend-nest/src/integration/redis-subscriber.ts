import Redis from 'ioredis';

async function subscribeWithTimeout(
  subscriber: Redis,
  channel: string,
  timeoutMs = 5000,
): Promise<void> {
  return Promise.race([
    subscriber.subscribe(channel).then(() => undefined),
    new Promise<void>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Redis subscribe to '${channel}' timed out after ${timeoutMs}ms`,
            ),
        ),
        timeoutMs,
      ),
    ),
  ]);
}

export class LogisticsRedisSubscriber {
  private subscriber: Redis;

  constructor() {
    // no-op: real connection happens in start() with retries
  }

  async start(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    const client = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on('error', (err) => {
      console.error('[logistics] Redis subscriber error', err);
    });

    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG') throw new Error('Redis startup ping returned an unexpected response');

      client.on('connect', () => {
        console.log('[logistics] Redis subscriber connected');
      });

      await subscribeWithTimeout(client, 'portfolio:stock-sync', 5000);
      this.subscriber = client;
      console.log('[logistics] Subscribed to portfolio:stock-sync');

      client.on('message', (channel, message) => {
        if (channel === 'portfolio:stock-sync') {
          console.log('[logistics] Received stock-sync event:', message);
        }
      });
    } catch (error) {
      client.disconnect();
      throw error;
    }
  }
}
