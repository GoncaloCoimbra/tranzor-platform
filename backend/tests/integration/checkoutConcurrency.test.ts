import mongoose, { Types } from 'mongoose';
import Product from '../../server/models/Product';
import Order from '../../server/models/Order';
import { enqueueCheckout } from '../../server/services/checkoutQueueService';

jest.mock('../../server/services/stockLockService', () => ({
  acquireStockLock: jest.fn(async (productId: string) => `integration-lock-${productId}-${Math.random()}`),
  releaseStockLock: jest.fn().mockResolvedValue(undefined),
}));

const mongoUri = process.env.CHECKOUT_TEST_MONGODB_URI;
const describeWithMongo = mongoUri ? describe : describe.skip;

describeWithMongo('checkout stock race against disposable MongoDB', () => {
  const productId = new Types.ObjectId();
  const orderIds = [new Types.ObjectId(), new Types.ObjectId()];

  beforeAll(async () => {
    if (!mongoUri) throw new Error('CHECKOUT_TEST_MONGODB_URI is required');

    const target = new URL(mongoUri);
    if (
      !['127.0.0.1', 'localhost'].includes(target.hostname)
      || !/^\/tranzor_checkout_test_[a-z0-9_]+$/i.test(target.pathname)
    ) {
      throw new Error('Checkout integration tests require a loopback MongoDB and a tranzor_checkout_test_* database');
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  });

  beforeEach(async () => {
    const now = new Date();
    await Product.collection.insertOne({
      _id: productId,
      name: 'Last stock item',
      slug: `last-stock-${productId.toHexString()}`,
      description: 'Disposable item for concurrent checkout integration test.',
      price: 10,
      category: new Types.ObjectId(),
      sku: `RACE-${productId.toHexString().slice(-12).toUpperCase()}`,
      images: [],
      variants: [],
      specifications: {},
      tags: [],
      inStock: true,
      stockQuantity: 1,
      lowStockThreshold: 5,
      rating: { average: 0, count: 0 },
      isActive: true,
      isFeatured: false,
      isNew: false,
      salesCount: 0,
      viewCount: 0,
      createdBy: new Types.ObjectId(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });

    await Order.collection.insertMany(orderIds.map((id) => ({
      _id: id,
      orderNumber: `TEST-${id.toHexString()}`,
      user: new Types.ObjectId(),
      items: [],
      subtotal: 10,
      total: 10,
      paymentMethod: 'integration-test',
      shippingMethod: 'integration-test',
      status: 'pending',
      paymentStatus: 'pending',
      shippingAddress: {
        name: 'Test User',
        email: 'test@example.invalid',
        phone: '0000000000',
        street: 'Test Street',
        city: 'Test City',
        postalCode: '0000-000',
        country: 'Portugal',
      },
      billingAddress: {
        name: 'Test User',
        email: 'test@example.invalid',
        phone: '0000000000',
        street: 'Test Street',
        city: 'Test City',
        postalCode: '0000-000',
        country: 'Portugal',
      },
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    })));
  });

  afterEach(async () => {
    await Product.collection.deleteOne({ _id: productId });
    await Order.collection.deleteMany({ _id: { $in: orderIds } });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('allows one last-unit purchase and leaves stock and salesCount changed only once', async () => {
    const outcomes = await Promise.allSettled(orderIds.map(async (orderId, index) => {
      const job = await enqueueCheckout({
        orderId: orderId.toHexString(),
        userId: `integration-user-${index}`,
        items: [{ productId: productId.toHexString(), quantity: 1 }],
        timestamp: Date.now(),
      });
      return job.finished();
    }));

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    const failed = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(failed).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({
        message: expect.stringMatching(/Stock insuficiente|Stock insuficiente ou alterado/),
      }),
    });

    const finalProduct = await Product.findById(productId).lean();
    expect(finalProduct).toMatchObject({
      stockQuantity: 0,
      salesCount: 1,
      inStock: false,
    });

    const finalOrders = await Order.find({ _id: { $in: orderIds } }).lean();
    expect(finalOrders.map((order) => order.status).sort()).toEqual(['confirmed', 'failed']);
    expect(finalOrders.map((order) => order.paymentStatus).sort()).toEqual(['completed', 'failed']);
  });
});
