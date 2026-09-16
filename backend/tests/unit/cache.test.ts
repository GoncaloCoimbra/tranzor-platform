const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn().mockResolvedValue('OK');
const mockGet = jest.fn().mockResolvedValue(null);
const mockDel = jest.fn().mockResolvedValue(1);
const mockKeys = jest.fn().mockResolvedValue([]);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

const RedisMock = jest.fn().mockImplementation(() => ({
  connect: mockConnect,
  set: mockSet,
  get: mockGet,
  del: mockDel,
  keys: mockKeys,
  disconnect: mockDisconnect,
  status: 'ready',
  on: jest.fn(),
}));

jest.mock('ioredis', () => ({
  __esModule: true,
  default: RedisMock,
}));

describe('distributed cache', () => {
  let originalNodeEnv: string | undefined;
  let originalJestWorkerId: string | undefined;
  let originalDisableRedis: string | undefined;
  let originalRedisUrl: string | undefined;

  beforeEach(() => {
    jest.resetModules();
    originalNodeEnv = process.env.NODE_ENV;
    originalJestWorkerId = process.env.JEST_WORKER_ID;
    originalDisableRedis = process.env.DISABLE_REDIS;
    originalRedisUrl = process.env.REDIS_URL;

    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;
    process.env.DISABLE_REDIS = 'false';
    process.env.REDIS_URL = 'redis://localhost:6379';
    mockConnect.mockClear();
    mockSet.mockClear();
    mockGet.mockClear();
    mockDel.mockClear();
    mockKeys.mockClear();
    mockDisconnect.mockClear();
    RedisMock.mockClear();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalJestWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalJestWorkerId;
    }

    if (originalDisableRedis === undefined) {
      delete process.env.DISABLE_REDIS;
    } else {
      process.env.DISABLE_REDIS = originalDisableRedis;
    }

    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('writes through Redis and reads back the cached value', async () => {
    const { setCachedValue, getCachedValue, clearCachedValue } = require('../../server/utils/cache');

    mockGet.mockResolvedValue(JSON.stringify({
      value: { price: 25 },
      expiresAt: Date.now() + 5000,
    }));

    await setCachedValue('shop:catalog:1', { price: 25 }, 5000);
    const value = await getCachedValue<{ price: number }>('shop:catalog:1');

    expect(RedisMock).toHaveBeenCalledWith('redis://localhost:6379', expect.objectContaining({ lazyConnect: true }));
    const setPayload = JSON.parse(mockSet.mock.calls[0][1]);
    expect(mockSet).toHaveBeenCalledWith('shop:catalog:1', expect.any(String), 'PX', 5000);
    expect(setPayload.value).toEqual({ price: 25 });
    expect(setPayload.expiresAt).toEqual(expect.any(Number));
    expect(value).toEqual({ price: 25 });

    await clearCachedValue('shop:catalog:1');
    expect(mockDel).toHaveBeenCalledWith('shop:catalog:1');
  });
});
