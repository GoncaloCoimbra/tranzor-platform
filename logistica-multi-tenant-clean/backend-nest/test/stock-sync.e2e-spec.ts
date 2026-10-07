import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant-context.service';
import {
  LogisticsRedisSubscriber,
  STOCK_SYNC_CHANNEL,
  StockSyncEvent,
} from '../src/integration/redis-subscriber';

const describeIntegration =
  process.env.RUN_REDIS_SUBSCRIBER_INTEGRATION === 'true'
    ? describe
    : describe.skip;

describeIntegration('Logistics Redis stock sync integration', () => {
  let prisma: PrismaService | undefined;
  let subscriber: LogisticsRedisSubscriber | undefined;
  let publisher: Redis | undefined;
  let prismaInitialized = false;
  let companyAId = '';
  let companyBId = '';
  let supplierAId = '';
  let supplierBId = '';
  let productAId = '';
  let productBId = '';
  let eventId = '';
  let sku = '';

  beforeAll(async () => {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (!process.env.DATABASE_URL || !redisUrl) {
      throw new Error(
        'This integration test requires an isolated DATABASE_URL and REDIS_URL',
      );
    }

    prisma = new PrismaService(new TenantContextService());
    await prisma.onModuleInit();
    prismaInitialized = true;

    const unique = randomUUID();
    sku = `STOCK-SYNC-${unique}`;
    const companyA = await prisma.company.create({
      data: {
        name: `Stock sync tenant A ${unique}`,
        nif: `SSA-${unique}`,
        email: `stock-sync-a-${unique}@example.test`,
      },
      select: { id: true },
    });
    companyAId = companyA.id;
    const companyB = await prisma.company.create({
      data: {
        name: `Stock sync tenant B ${unique}`,
        nif: `SSB-${unique}`,
        email: `stock-sync-b-${unique}@example.test`,
      },
      select: { id: true },
    });
    companyBId = companyB.id;
    const supplierA = await prisma.supplier.create({
      data: {
        name: `Stock sync supplier A ${unique}`,
        nif: `SSA-SUP-${unique}`,
        companyId: companyAId,
      },
      select: { id: true },
    });
    supplierAId = supplierA.id;
    const supplierB = await prisma.supplier.create({
      data: {
        name: `Stock sync supplier B ${unique}`,
        nif: `SSB-SUP-${unique}`,
        companyId: companyBId,
      },
      select: { id: true },
    });
    supplierBId = supplierB.id;
    const productA = await prisma.product.create({
      data: {
        internalCode: sku,
        description: 'Tenant A stock sync fixture',
        quantity: 2,
        unit: 'unit',
        supplierId: supplierAId,
        companyId: companyAId,
      },
      select: { id: true },
    });
    productAId = productA.id;
    const productB = await prisma.product.create({
      data: {
        internalCode: sku,
        description: 'Tenant B stock sync fixture',
        quantity: 9,
        unit: 'unit',
        supplierId: supplierBId,
        companyId: companyBId,
      },
      select: { id: true },
    });
    productBId = productB.id;

    subscriber = new LogisticsRedisSubscriber(prisma);
    await subscriber.start();
    publisher = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    await publisher.connect();
  });

  afterAll(async () => {
    if (publisher) await publisher.quit();
    if (subscriber) await subscriber.stop();
    if (prisma && prismaInitialized) {
      if (eventId) {
        await prisma.processedStockSyncEvent.deleteMany({ where: { eventId } });
      }
      if (companyAId || companyBId) {
        await prisma.stockSyncDeadLetter.deleteMany({
          where: {
            companyId: { in: [companyAId, companyBId].filter(Boolean) },
          },
        });
      }
      if (productAId || productBId) {
        await prisma.product.deleteMany({
          where: { id: { in: [productAId, productBId].filter(Boolean) } },
        });
      }
      if (supplierAId || supplierBId) {
        await prisma.supplier.deleteMany({
          where: { id: { in: [supplierAId, supplierBId].filter(Boolean) } },
        });
      }
      if (companyAId || companyBId) {
        await prisma.company.deleteMany({
          where: { id: { in: [companyAId, companyBId].filter(Boolean) } },
        });
      }
      await prisma.$disconnect();
    }
  });

  it('applies a published snapshot once and only within its tenant', async () => {
    if (!prisma || !subscriber || !publisher) {
      throw new Error(
        'Stock sync integration prerequisites were not initialized',
      );
    }
    const db = prisma;
    const stockSubscriber = subscriber;
    const redisPublisher = publisher;
    const product = await db.product.findFirst({
      where: { id: productAId, companyId: companyAId },
      select: { updatedAt: true },
    });
    if (!product)
      throw new Error('Tenant A test product disappeared before the test');

    eventId = randomUUID();
    const event: StockSyncEvent = {
      eventId,
      type: 'stock_sync',
      companyId: companyAId,
      sku,
      stock: 7,
      productUpdatedAt: product.updatedAt.toISOString(),
      description: 'Tenant A stock sync fixture',
      source: 'chatops',
      timestamp: new Date().toISOString(),
    };
    const message = JSON.stringify(event);

    await redisPublisher.publish(STOCK_SYNC_CHANNEL, message);
    await waitForStock(7);

    const firstState = await db.product.findFirst({
      where: { id: productAId, companyId: companyAId },
      select: { quantity: true, updatedAt: true },
    });
    expect(firstState?.quantity).toBe(7);

    await stockSubscriber.handleMessage(message);
    const duplicateState = await db.product.findFirst({
      where: { id: productAId, companyId: companyAId },
      select: { quantity: true, updatedAt: true },
    });
    const otherTenantProduct = await db.product.findFirst({
      where: { id: productBId, companyId: companyBId },
      select: { quantity: true },
    });
    const processedEvents = await db.processedStockSyncEvent.count({
      where: { eventId, companyId: companyAId },
    });

    expect(duplicateState).toEqual(firstState);
    expect(otherTenantProduct?.quantity).toBe(9);
    expect(processedEvents).toBe(1);
  });

  async function waitForStock(expected: number): Promise<void> {
    if (!prisma) throw new Error('Prisma was not initialized');
    const db = prisma;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const product = await db.product.findFirst({
        where: { id: productAId, companyId: companyAId },
        select: { quantity: true },
      });
      if (product?.quantity === expected) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Stock did not change to ${expected} within 5 seconds`);
  }
});
