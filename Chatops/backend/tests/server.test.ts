let fastify: any;
let stopServer: (() => Promise<void>) | undefined;
import { parseUserIdFromToken } from '../src/auth';

describe('ChatOps /health', () => {
  beforeAll(async () => {
    process.env.SKIP_PRISMA = 'true';
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

  it('should return health metadata including redis status', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('ok', true);
    expect(body).toHaveProperty('redis');
    expect(body.redis).toHaveProperty('configured');
    expect(body.redis).toHaveProperty('connected');
    expect(body.redis).toHaveProperty('source');
    expect(body).toHaveProperty('websocket');
    expect(body.websocket).toBe('enabled');
  });

  it('should issue a signed token for the demo client outside production', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/auth/dev-token' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(parseUserIdFromToken(`Bearer ${body.token}`)).toBe('goncalo');
  });

  it('should hide the demo token endpoint in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await fastify.inject({ method: 'GET', url: '/auth/dev-token' });
      expect(res.statusCode).toBe(404);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
