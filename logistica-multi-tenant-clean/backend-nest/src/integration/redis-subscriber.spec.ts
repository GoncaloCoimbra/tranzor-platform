import { PrismaService } from '../database/prisma.service';
import {
  LogisticsRedisSubscriber,
  parseStockSyncEvent,
} from './redis-subscriber';

describe('parseStockSyncEvent', () => {
  const validEvent = {
    eventId: '0199c2d8-65f1-7a16-aec4-7c9c2b8cb01a',
    type: 'stock_sync',
    companyId: 'tenant-a',
    sku: 'SKU-1',
    stock: 12,
    productUpdatedAt: '2026-10-06T12:00:00.000Z',
    description: 'Test product',
    source: 'chatops',
    timestamp: '2026-10-06T12:01:00.000Z',
  };

  it('accepts a tenant-scoped stock snapshot with version metadata', () => {
    expect(parseStockSyncEvent(JSON.stringify(validEvent))).toEqual(validEvent);
  });

  it.each([
    { ...validEvent, eventId: 'not-a-uuid' },
    { ...validEvent, companyId: '' },
    { ...validEvent, stock: -1 },
    { ...validEvent, stock: Number.NaN },
    { ...validEvent, productUpdatedAt: 'not-a-date' },
    { ...validEvent, type: 'stock_delta' },
  ])('rejects an event outside the schema', (event) => {
    expect(() => parseStockSyncEvent(JSON.stringify(event))).toThrow(
      'Stock sync message does not match the required schema',
    );
  });

  it('rejects invalid JSON with an explicit validation error', () => {
    expect(() => parseStockSyncEvent('{')).toThrow(
      'Stock sync message is not valid JSON',
    );
  });

  it('does not apply an older snapshot after a newer version was applied', async () => {
    const originalVersion = new Date('2026-10-06T12:00:00.000Z');
    const newerVersion = new Date('2026-10-06T12:02:00.000Z');
    let stock = 12;
    let updatedAt = originalVersion;
    const transaction = {
      processedStockSyncEvent: { create: jest.fn().mockResolvedValue({}) },
      product: {
        findFirst: jest.fn(async () => ({ id: 'product-1', updatedAt })),
        updateMany: jest.fn(
          async ({ data }: { data: { quantity: number } }) => {
            stock = data.quantity;
            updatedAt = newerVersion;
            return { count: 1 };
          },
        ),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      stockSyncDeadLetter: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const subscriber = new LogisticsRedisSubscriber(prisma);
    const newerEvent = {
      eventId: '0199c2d8-65f1-7a16-aec4-7c9c2b8cb02b',
      type: 'stock_sync' as const,
      companyId: 'tenant-a',
      sku: 'SKU-1',
      stock: 7,
      productUpdatedAt: originalVersion.toISOString(),
      source: 'chatops' as const,
      timestamp: '2026-10-06T12:02:01.000Z',
    };
    const olderEvent = {
      ...newerEvent,
      eventId: '0199c2d8-65f1-7a16-aec4-7c9c2b8cb02c',
      stock: 15,
      timestamp: '2026-10-06T12:01:00.000Z',
    };

    await subscriber.handleMessage(JSON.stringify(newerEvent));
    await subscriber.handleMessage(JSON.stringify(olderEvent));

    expect(stock).toBe(7);
    expect(transaction.product.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.stockSyncDeadLetter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: olderEvent.eventId,
        companyId: olderEvent.companyId,
        attempts: 1,
      }),
    });
  });
});
