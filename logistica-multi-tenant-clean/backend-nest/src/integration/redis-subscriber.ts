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
      console.error('[logistics] REDIS_URL not set — refusing to start with silent fallback to 127.0.0.1');
      throw new Error('REDIS_URL environment variable is required');
    }

    const maxAttempts = 3;
    const delayMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const client = new Redis(redisUrl, {
          lazyConnect: true,
          connectTimeout: 5000,
        });
        await Promise.race([
          client.connect(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Redis connection timed out after 5000ms')),
              5000,
            ),
          ),
        ]);
        await client.ping();

        this.subscriber = client;
        this.subscriber.on('connect', () => {
          console.log('[logistics] Redis subscriber connected');
        });
        this.subscriber.on('error', (err) => {
          console.error('[logistics] Redis subscriber error', err);
        });

        await subscribeWithTimeout(this.subscriber, 'portfolio:stock-sync', 5000);
        console.log('[logistics] Subscribed to portfolio:stock-sync');

        this.subscriber.on('message', (channel, message) => {
          if (channel === 'portfolio:stock-sync') {
            console.log('[logistics] Received stock-sync event:', message);
          }
        });

        return; // success
      } catch (err) {
        console.error(`[logistics] Redis connection attempt ${attempt} failed:`, err);
        try {
          if (this.subscriber) this.subscriber.disconnect();
        } catch (e) {
          /* ignore */
        }
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        console.error('[logistics] All Redis connection attempts failed — throwing');
        throw err;
      }
    }
  }
}
