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

const mockAcquireStockLock = jest.fn();
const mockReleaseStockLock = jest.fn();

jest.mock('../server/models/Product', () => ({
  __esModule: true,
  default: mockProduct,
}));

jest.mock('../server/models/Order', () => ({
  __esModule: true,
  default: mockOrder,
}));

jest.mock('../server/services/stockLockService', () => ({
  acquireStockLock: mockAcquireStockLock,
  releaseStockLock: mockReleaseStockLock,
}));

describe('checkout queue fallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockAcquireStockLock.mockResolvedValue(null);
    mockReleaseStockLock.mockResolvedValue(undefined);
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

  it('fails checkout when a required distributed stock lock is unavailable', async () => {
    const { enqueueCheckout, getQueueStats } = require('../server/services/checkoutQueueService');

    const job = await enqueueCheckout({
      orderId: 'order-1',
      userId: 'user-1',
      items: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }],
      timestamp: Date.now(),
    });

    await expect(job.finished()).rejects.toThrow(
      'TIMEOUT ao adquirir lock para produto 507f1f77bcf86cd799439011',
    );
    expect(mockProduct.findById).not.toHaveBeenCalled();
    const stats = await getQueueStats();
    expect(stats).toEqual({
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    });
  });

  it('compensates only completed decrements and reverses stock and salesCount', async () => {
    mockAcquireStockLock
      .mockResolvedValueOnce('lock-product-1')
      .mockResolvedValueOnce('lock-product-2');
    mockProduct.findById.mockImplementation(async (productId: string) => ({
      _id: productId,
      name: productId,
      inStock: true,
      stockQuantity: productId === 'product-1' ? 4 : 5,
      save: jest.fn().mockResolvedValue(undefined),
    }));

    const firstUpdatedProduct = {
      stockQuantity: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    mockProduct.findByIdAndUpdate
      .mockResolvedValueOnce(firstUpdatedProduct)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ stockQuantity: 4, inStock: true });

    const { enqueueCheckout } = require('../server/services/checkoutQueueService');
    const job = await enqueueCheckout({
      orderId: 'order-mid-checkout-failure',
      userId: 'user-1',
      items: [
        { productId: 'product-1', quantity: 4 },
        { productId: 'product-2', quantity: 2 },
      ],
      timestamp: Date.now(),
    });

    await expect(job.finished()).rejects.toThrow(
      'Falha ao atualizar stock para produto product-2',
    );
    expect(mockProduct.findByIdAndUpdate).toHaveBeenNthCalledWith(
      3,
      'product-1',
      {
        $inc: { stockQuantity: 4, salesCount: -4 },
        $set: { inStock: true },
      },
    );
    expect(mockProduct.findByIdAndUpdate).toHaveBeenCalledTimes(3);
    expect(mockOrder.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-mid-checkout-failure',
      expect.objectContaining({ status: 'failed', paymentStatus: 'failed' }),
    );
    expect(mockReleaseStockLock).toHaveBeenCalledTimes(2);
  });
});
