describe('ChatOps observability endpoints', () => {
  let fastify: any;
  let stopServer: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    const serverModule = await import('../src/server');
    fastify = serverModule.fastify;
    stopServer = serverModule.stopServer;

    await fastify.ready();
  });

  afterAll(async () => {
    if (stopServer) {
      await stopServer();
    }
  });

  it('returns readiness and runtime health details', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('status', 'ready');
    expect(body).toHaveProperty('uptimeSeconds');
    expect(body).toHaveProperty('metrics');
    expect(body.metrics).toHaveProperty('activeConnections');
    expect(body.metrics).toHaveProperty('activeChannels');
  });

  it('exposes a metrics endpoint with counters', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('counters');
    expect(body.counters).toHaveProperty('httpRequests');
    expect(body.counters).toHaveProperty('websocketConnections');
    expect(body.counters).toHaveProperty('commandsExecuted');
  });

  it('exposes a Prometheus scraping endpoint for observability integration', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/metrics/prometheus' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.payload).toContain('chatops_http_requests_total');
  });

  it('exposes readiness and liveness endpoints for operational probes', async () => {
    const readyRes = await fastify.inject({ method: 'GET', url: '/readyz' });
    expect(readyRes.statusCode).toBe(200);

    const liveRes = await fastify.inject({ method: 'GET', url: '/livez' });
    expect(liveRes.statusCode).toBe(200);

    const readyBody = JSON.parse(readyRes.payload);
    expect(readyBody).toHaveProperty('ok', true);
    expect(readyBody).toHaveProperty('status', 'ready');
  });
});
