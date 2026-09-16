const mockProduct = {
  findById: jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    name: 'Laptop',
    inStock: true,
    stockQuantity: 10,
    save: jest.fn().mockResolvedValue(undefined),
  }),
  findByIdAndUpdate: jest.fn().mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    name: 'Laptop',
    inStock: true,
    stockQuantity: 9,
    save: jest.fn().mockResolvedValue(undefined),
  }),
};

const mockOrder = {
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
};

jest.mock('../server/models/Product', () => ({
  __esModule: true,
  default: mockProduct,
}));

jest.mock('../server/models/Order', () => ({
  __esModule: true,
  default: mockOrder,
}));

describe('checkout queue fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      DISABLE_REDIS: 'true',
      REDIS_URL: '',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should enqueue checkout jobs without depending on Redis', async () => {
    const { enqueueCheckout, getQueueStats } = require('../server/services/checkoutQueueService');

    const job = await enqueueCheckout({
      orderId: 'order-1',
      userId: 'user-1',
      items: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }],
      timestamp: Date.now(),
    });

    expect(job).toBeDefined();
    const stats = await getQueueStats();
    expect(stats).toEqual({
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    });
  });
});
