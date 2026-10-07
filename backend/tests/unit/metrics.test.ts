import { getMatchedRoute, getMetricsSnapshot, measureShopOperation, metricsMiddleware } from '../../server/utils/metrics';

describe('request and shop-operation metrics', () => {
  it('groups requests by matched route instead of dynamic path values', () => {
    const listeners: Record<string, () => void> = {};
    const request: any = {
      method: 'GET',
      path: '/507f1f77bcf86cd799439011',
      baseUrl: '',
    };
    const response: any = {
      statusCode: 200,
      on: (event: string, listener: () => void) => {
        listeners[event] = listener;
      },
    };

    metricsMiddleware(request, response, jest.fn());
    request.baseUrl = '/api/v1/shop/products';
    request.route = { path: '/:id' };
    listeners.finish();

    expect(getMetricsSnapshot().requestsByRoute['GET /api/v1/shop/products/:id']).toMatchObject({
      count: 1,
      lastStatusCode: 200,
    });
    expect(getMetricsSnapshot().requestsByRoute).not.toHaveProperty(
      'GET /507f1f77bcf86cd799439011',
    );
    expect(getMatchedRoute(request)).toBe('/api/v1/shop/products/:id');
  });

  it('groups unmatched requests without retaining arbitrary paths', () => {
    const listeners: Array<() => void> = [];
    const request: any = { method: 'GET', path: '/unexpected/one', baseUrl: '' };
    const response: any = {
      statusCode: 404,
      on: (_event: string, listener: () => void) => listeners.push(listener),
    };

    metricsMiddleware(request, response, jest.fn());
    listeners[0]();
    request.path = '/unexpected/two';
    metricsMiddleware(request, response, jest.fn());
    listeners[1]();

    expect(getMetricsSnapshot().requestsByRoute['GET <unmatched>']).toMatchObject({
      count: 2,
      lastStatusCode: 404,
    });
    expect(getMetricsSnapshot().requestsByRoute).not.toHaveProperty('GET /unexpected/one');
    expect(getMetricsSnapshot().requestsByRoute).not.toHaveProperty('GET /unexpected/two');
    expect(getMatchedRoute(request)).toBe('<unmatched>');
  });

  it('returns successful operation results and propagates operation failures', async () => {
    await expect(measureShopOperation('test.success', async () => 'result')).resolves.toBe('result');
    await expect(
      measureShopOperation('test.failure', async () => {
        throw new Error('database failed');
      }),
    ).rejects.toThrow('database failed');
  });
});
