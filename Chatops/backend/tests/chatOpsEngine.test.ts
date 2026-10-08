/// <reference types="jest" />

import { ChatOpsEngine, logisticsCircuitBreaker } from '../src/chatOpsEngine';
import { prisma } from '../src/prismaClient';
import { publishPortfolioEvent, STOCK_SYNC_CHANNEL } from '../src/redisClient';

jest.mock('../src/prismaClient', () => ({
  prisma: {
    b2BClient: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../src/redisClient', () => ({
  publishPortfolioEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('ChatOpsEngine', () => {
  jest.setTimeout(20000);
  const originalLogisticsApiKey = process.env.LOGISTICS_API_KEY;

  afterEach(() => {
    jest.resetAllMocks();
    (global as any).fetch = undefined;
    (globalThis as any).fetch = undefined;
    if (originalLogisticsApiKey === undefined) delete process.env.LOGISTICS_API_KEY;
    else process.env.LOGISTICS_API_KEY = originalLogisticsApiKey;
  });

  it('returns null for non-command messages', async () => {
    await expect(ChatOpsEngine.handleCommand('hello world', 'user-1')).resolves.toBeNull();
  });

  it('returns a help message when /stock is missing a sku', async () => {
    await expect(ChatOpsEngine.handleCommand('/stock', 'user-1')).resolves.toBe(
      '❗ Especifica um SKU: /stock [sku]',
    );
  });

  it('returns a help message when /approve-credit is missing an id', async () => {
    await expect(ChatOpsEngine.handleCommand('/approve-credit', 'user-1')).resolves.toBe(
      '❗ Especifica um id de empresa: /approve-credit [id_empresa]',
    );
  });

  it('returns a translated help message when /order is missing an id', async () => {
    await expect(ChatOpsEngine.handleCommand('/order', 'user-1')).resolves.toBe(
      '❗ Especifica o ID da encomenda: /order [id]',
    );
    await expect(ChatOpsEngine.handleCommand('/order invalid', 'user-1', '', 'en')).resolves.toBe(
      '❗ The order ID is invalid.',
    );
  });

  it('returns an unknown command response for unsupported commands', async () => {
    await expect(ChatOpsEngine.handleCommand('/unknown', 'user-1')).resolves.toBe(
      '🤖 Comando não reconhecido. Exemplos: /stock [sku], /low-stock, /order [id] ou /approve-credit [id_empresa]',
    );
  });

  it('executes /stock successfully and returns localized Logistics stock info', async () => {
    process.env.LOGISTICS_API_KEY = 'test-logistics-api-key';
    const mockFetch = jest.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      json: async () => ({
        stock: 15,
        description: 'Demo SKU',
        companyId: 'logistics-company-1',
        updatedAt: '2026-10-06T12:00:00.000Z',
      }),
    }));
    (global as any).fetch = mockFetch;

    await expect(ChatOpsEngine.handleCommand('/stock SKU-123', 'user-1')).resolves.toBe(
      '📦 Stock atual da Logística: Demo SKU tem 15 unidades.',
    );
    await expect(ChatOpsEngine.handleCommand('/stock SKU-123', 'user-1', '', 'en')).resolves.toBe(
      '📦 Live stock via Logistics: Demo SKU has 15 units.',
    );
    await expect(ChatOpsEngine.handleCommand('/stock SKU-123', 'user-1', '', 'es')).resolves.toBe(
      '📦 Existencias actuales de Logística: Demo SKU tiene 15 unidades.',
    );

    // Expected URL depends on LOGISTICS_URL env var (default: http://logistica-backend:3000)
    const expectedUrl = `${process.env.LOGISTICS_URL || 'http://logistica-backend:3000'}/api/products/stock?sku=SKU-123`;
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({
      headers: { 'X-API-Key': 'test-logistics-api-key' },
    }));
    expect(publishPortfolioEvent).toHaveBeenLastCalledWith(
      STOCK_SYNC_CHANNEL,
      expect.any(String),
    );
    const event = JSON.parse((publishPortfolioEvent as jest.Mock).mock.calls.at(-1)[1]);
    expect(event).toMatchObject({
      type: 'stock_sync',
      companyId: 'logistics-company-1',
      sku: 'SKU-123',
      stock: 15,
      productUpdatedAt: '2026-10-06T12:00:00.000Z',
      source: 'chatops',
    });
    expect(event.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('reports an explicit configuration error when the Logistics API key is missing', async () => {
    delete process.env.LOGISTICS_API_KEY;
    const mockFetch = jest.fn();
    (global as any).fetch = mockFetch;
    (globalThis as any).fetch = mockFetch;

    await expect(ChatOpsEngine.handleCommand('/stock SKU-123', 'user-1')).resolves.toBe(
      'Consulta de stock indisponível: configure LOGISTICS_API_KEY no serviço ChatOps.',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lists products at or below the low-stock threshold', async () => {
    process.env.LOGISTICS_API_KEY = 'test-logistics-api-key';
    const mockFetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        threshold: 5,
        total: 2,
        products: [
          { internalCode: 'SKU-LOW-1', description: 'Low Stock One', quantity: 0, unit: 'pcs' },
          { internalCode: 'SKU-LOW-2', description: 'Low Stock Two', quantity: 5, unit: 'boxes' },
        ],
      }),
    }));
    (global as any).fetch = mockFetch;

    await expect(ChatOpsEngine.handleCommand('/low-stock', 'user-1')).resolves.toBe(
      '📦 Produtos com 5 ou menos unidades:\nSKU-LOW-1 — Low Stock One: 0 pcs\nSKU-LOW-2 — Low Stock Two: 5 boxes',
    );
    await expect(ChatOpsEngine.handleCommand('/low-stock', 'user-1', '', 'en')).resolves.toBe(
      '📦 Products with 5 units or fewer:\nSKU-LOW-1 — Low Stock One: 0 pcs\nSKU-LOW-2 — Low Stock Two: 5 boxes',
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.LOGISTICS_URL || 'http://logistica-backend:3000'}/api/products/low-stock`,
      expect.objectContaining({ headers: { 'X-API-Key': 'test-logistics-api-key' } }),
    );
  });

  it('reports when there are no low-stock products', async () => {
    process.env.LOGISTICS_API_KEY = 'test-logistics-api-key';
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ threshold: 5, total: 0, products: [] }),
    }));

    await expect(ChatOpsEngine.handleCommand('/low-stock', 'user-1')).resolves.toBe(
      '✅ Não há produtos com 5 ou menos unidades em stock.',
    );
  });

  it('checks order status using the current user Commerce token without sending the Logistics API key', async () => {
    process.env.LOGISTICS_API_KEY = 'test-logistics-api-key';
    const mockFetch = jest.fn(async (_url: string, _options?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, status: 'confirmed', paymentStatus: 'paid' }),
    }));
    (global as any).fetch = mockFetch;
    const orderId = '0123456789abcdef01234567';

    await expect(ChatOpsEngine.handleCommand('/order ' + orderId, 'user-1', '', 'pt', 'user-commerce-token')).resolves.toBe(
      `📦 Encomenda ${orderId}: confirmada; pagamento pago.`,
    );
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.COMMERCE_API_URL || 'http://backend:3001/api/v1'}/orders/checkout/${orderId}/status`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer user-commerce-token' },
      }),
    );
  });

  it('does not expose whether another user owns an order', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 403 }));

    await expect(ChatOpsEngine.handleCommand(
      '/order 0123456789abcdef01234567',
      'user-1',
      '',
      'pt',
      'user-commerce-token',
    )).resolves.toBe('❌ Encomenda não encontrada ou sem permissão para a consultar.');
  });

  it('localizes command responses to the selected language', async () => {
    delete process.env.LOGISTICS_API_KEY;

    await expect(ChatOpsEngine.handleCommand('/stock SKU-123', 'user-1', '', 'en')).resolves.toBe(
      'Stock lookup is unavailable: configure LOGISTICS_API_KEY in the ChatOps service.',
    );
    await expect(ChatOpsEngine.handleCommand('/approve-credit 123', 'user-1', 'user', 'es')).resolves.toBe(
      'No tienes permiso para aprobar crédito.',
    );
  });

  it('approves credit when /approve-credit has an id', async () => {
    const updateMock = prisma.b2BClient.update as jest.Mock;
    updateMock.mockResolvedValue({});

    await expect(ChatOpsEngine.handleCommand('/approve-credit 123', 'user-1', 'admin')).resolves.toBe(
      '✅ Crédito aprovado para empresa 123.',
    );

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '123' },
      data: { creditStatus: 'APPROVED' },
    });
  });

  it('blocks credit approval for users without the configured role', async () => {
    const updateMock = prisma.b2BClient.update as jest.Mock;

    await expect(ChatOpsEngine.handleCommand('/approve-credit 123', 'user-1', 'user')).resolves.toBe(
      'Não tem permissão para aprovar crédito.',
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('opens the circuit breaker on repeated Logistics failures and returns the fallback message', async () => {
    process.env.LOGISTICS_API_KEY = 'test-logistics-api-key';
    const networkError = new Error('network failure') as any;
    networkError.name = 'AbortError';

    const mockFetch = jest.fn()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stock: 22,
          description: 'Recovered SKU',
          companyId: 'logistics-company-1',
          updatedAt: '2026-10-06T12:00:00.000Z',
        }),
      });

    const originalGlobalFetch = (global as any).fetch;
    const originalGlobalThisFetch = (globalThis as any).fetch;
    (global as any).fetch = mockFetch;
    (globalThis as any).fetch = mockFetch;
    logisticsCircuitBreaker.reset();

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    // Each failed /stock request does 3 retries and counts as one circuit failure.
    await expect(ChatOpsEngine.handleCommand('/stock SKU-FAIL', 'user-1')).resolves.toMatch(/indisponível/);
    await expect(ChatOpsEngine.handleCommand('/stock SKU-FAIL', 'user-1')).resolves.toMatch(/indisponível/);
    await expect(ChatOpsEngine.handleCommand('/stock SKU-FAIL', 'user-1')).resolves.toMatch(/indisponível/);

    expect(mockFetch).toHaveBeenCalledTimes(9);

    // Next call before reset timeout should return the circuit breaker fallback immediately.
    await expect(ChatOpsEngine.handleCommand('/stock SKU-FAIL', 'user-1')).resolves.toBe(
      '❌ Logística está temporariamente indisponível. Tente novamente em alguns segundos.',
    );

    nowSpy.mockReturnValue(1_000_000 + 31_000);

    await expect(ChatOpsEngine.handleCommand('/stock SKU-RECOVER', 'user-1')).resolves.toBe(
      '📦 Stock atual da Logística: Recovered SKU tem 22 unidades.',
    );

    nowSpy.mockRestore();
    (global as any).fetch = originalGlobalFetch;
    (globalThis as any).fetch = originalGlobalThisFetch;
  });
});
