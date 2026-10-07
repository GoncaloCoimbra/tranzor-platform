import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

export const STOCK_SYNC_CHANNEL = 'portfolio:stock-sync';
const MAX_PROCESS_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;
const MAX_MESSAGE_LENGTH = 65_536;

export interface StockSyncEvent {
  eventId: string;
  type: 'stock_sync';
  companyId: string;
  sku: string;
  stock: number;
  productUpdatedAt: string;
  description?: string;
  source: 'chatops';
  timestamp: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    return false;
  return new Date(value).toISOString() === value;
}

export function parseStockSyncEvent(message: string): StockSyncEvent {
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Stock sync message exceeds ${MAX_MESSAGE_LENGTH} characters`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch (error) {
    throw new Error(
      `Stock sync message is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!isRecord(parsed))
    throw new Error('Stock sync message must be a JSON object');

  const {
    eventId,
    type,
    companyId,
    sku,
    stock,
    productUpdatedAt,
    description,
    source,
    timestamp,
  } = parsed;
  if (
    typeof eventId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId,
    ) ||
    type !== 'stock_sync' ||
    typeof companyId !== 'string' ||
    companyId.trim().length === 0 ||
    typeof sku !== 'string' ||
    sku.trim().length === 0 ||
    typeof stock !== 'number' ||
    !Number.isFinite(stock) ||
    stock < 0 ||
    !isIsoDate(productUpdatedAt) ||
    (description !== undefined && typeof description !== 'string') ||
    source !== 'chatops' ||
    !isIsoDate(timestamp)
  ) {
    throw new Error('Stock sync message does not match the required schema');
  }

  return {
    eventId,
    type,
    companyId,
    sku,
    stock,
    productUpdatedAt,
    ...(description === undefined ? {} : { description }),
    source,
    timestamp,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return isRecord(error) && error.code === 'P2002';
}

class StaleStockSyncEventError extends Error {}

export class LogisticsRedisSubscriber {
  private subscriber: Redis | undefined;

  constructor(private readonly prisma: PrismaService) {}

  async start(): Promise<void> {
    if (this.subscriber) return;

    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl)
      throw new Error('REDIS_URL environment variable is required');

    const client = new Redis(redisUrl, {
      lazyConnect: true,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    client.on('error', (error) => {
      console.error('[logistics] Redis subscriber error', error);
    });

    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG')
        throw new Error('Redis startup ping returned an unexpected response');
      await client.subscribe(STOCK_SYNC_CHANNEL);
      client.on('message', (channel, message) => {
        if (channel === STOCK_SYNC_CHANNEL) {
          void this.handleMessage(message).catch((error) => {
            console.error(
              '[logistics] Failed to persist stock sync event or dead letter',
              error,
            );
          });
        }
      });
      this.subscriber = client;
      console.log(`[logistics] Subscribed to ${STOCK_SYNC_CHANNEL}`);
    } catch (error) {
      client.disconnect();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.subscriber) return;
    const subscriber = this.subscriber;
    this.subscriber = undefined;
    await subscriber.unsubscribe(STOCK_SYNC_CHANNEL);
    await subscriber.quit();
  }

  async handleMessage(message: string): Promise<void> {
    let event: StockSyncEvent;
    try {
      event = parseStockSyncEvent(message);
    } catch (error) {
      console.error('[logistics] Rejected invalid stock sync event', error);
      await this.persistDeadLetter(message, null, null, 0, error);
      return;
    }

    for (let attempt = 1; attempt <= MAX_PROCESS_ATTEMPTS; attempt += 1) {
      try {
        const applied = await this.applyEvent(event);
        if (applied) {
          console.log(
            `[logistics] Applied stock sync event ${event.eventId} to tenant ${event.companyId}`,
          );
        } else {
          console.log(
            `[logistics] Ignored duplicate stock sync event ${event.eventId}`,
          );
        }
        return;
      } catch (error) {
        console.error(
          `[logistics] Stock sync event ${event.eventId} attempt ${attempt} failed`,
          error,
        );
        if (error instanceof StaleStockSyncEventError) {
          await this.persistDeadLetter(
            message,
            event.eventId,
            event.companyId,
            attempt,
            error,
          );
          return;
        }
        if (attempt === MAX_PROCESS_ATTEMPTS) {
          await this.persistDeadLetter(
            message,
            event.eventId,
            event.companyId,
            attempt,
            error,
          );
          return;
        }
        await new Promise<void>((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS * 2 ** (attempt - 1)),
        );
      }
    }
  }

  private async applyEvent(event: StockSyncEvent): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.processedStockSyncEvent.create({
          data: {
            eventId: event.eventId,
            companyId: event.companyId,
            sku: event.sku,
          },
        });

        const product = await transaction.product.findFirst({
          where: {
            companyId: event.companyId,
            internalCode: event.sku,
          },
          select: { id: true, updatedAt: true },
        });
        if (!product) {
          throw new Error(
            `No product ${event.sku} exists for tenant ${event.companyId}`,
          );
        }
        if (product.updatedAt.toISOString() !== event.productUpdatedAt) {
          throw new StaleStockSyncEventError(
            `Stock sync event ${event.eventId} is stale; product changed after the snapshot`,
          );
        }

        const result = await transaction.product.updateMany({
          where: {
            id: product.id,
            companyId: event.companyId,
            updatedAt: product.updatedAt,
          },
          data: { quantity: event.stock },
        });
        if (result.count !== 1) {
          throw new StaleStockSyncEventError(
            `Stock sync event ${event.eventId} lost its version check`,
          );
        }
      });
      return true;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  private async persistDeadLetter(
    payload: string,
    eventId: string | null,
    companyId: string | null,
    attempts: number,
    error: unknown,
  ): Promise<void> {
    const storedPayload =
      payload.length > MAX_MESSAGE_LENGTH
        ? payload.slice(0, MAX_MESSAGE_LENGTH)
        : payload;
    const failure = getErrorMessage(error);
    console.error(
      '[logistics] Sending stock sync event to database dead-letter table',
      {
        eventId,
        companyId,
        attempts,
        error: failure,
      },
    );
    await this.prisma.stockSyncDeadLetter.create({
      data: {
        eventId,
        companyId,
        channel: STOCK_SYNC_CHANNEL,
        payload: storedPayload,
        error: failure.slice(0, 4000),
        attempts,
      },
    });
  }
}
