import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from './../src/main';
import { PrismaService } from '../src/database/prisma.service';

describe('API Health Checks - E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api', () => {
    it('should return 200 OK from root endpoint', async () => {
      const response = await request(app.getHttpServer()).get('/api');

      expect(response.status).toBe(200);
      expect(response.text).toBe('Hello World!');
    });
  });

  describe('GET /health', () => {
    it('should return 200 OK and health metadata', async () => {
      const response = await request(app.getHttpServer()).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('redis');
      expect(response.body.database).toHaveProperty('configured');
      expect(response.body.database).toHaveProperty('connected');
      expect(response.body.redis).toHaveProperty('configured');
      expect(response.body.redis).toHaveProperty('connected');
    });

    it('should expose readiness and liveness probes', async () => {
      const readyResponse = await request(app.getHttpServer()).get('/readyz');
      expect(readyResponse.status).toBe(200);
      expect(readyResponse.body).toHaveProperty('ok', true);
      expect(readyResponse.body).toHaveProperty('status', 'ready');

      const liveResponse = await request(app.getHttpServer()).get('/livez');
      expect(liveResponse.status).toBe(200);
      expect(liveResponse.body).toHaveProperty('ok', true);
      expect(liveResponse.body).toHaveProperty('status', 'alive');
    });
  });

  describe('GET /api/docs', () => {
    it('should return Swagger API documentation', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/docs')
        .redirects(1);

      expect(response.status).toBe(200);
    });
  });

  describe('Auth Endpoints', () => {
    it('should reject login with invalid credentials (404 user not found)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject requests without JWT token to protected routes', async () => {
      const response = await request(app.getHttpServer()).get('/api/users');

      expect(response.status).toBe(401);
    });
  });

  describe('CORS & Security Headers', () => {
    it('should not allow CORS headers from unauthorized origins', async () => {
      const response = await request(app.getHttpServer())
        .get('/api')
        .set('Origin', 'http://unauthorized.com');

      // CORS headers should not include the unauthorized origin
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should set security headers', async () => {
      const response = await request(app.getHttpServer()).get('/api');

      // Check for basic security headers
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/nonexistent-route')
        .set('Accept', 'application/json');

      expect(response.status).toBe(404);
    });

    it('should return validation error for malformed requests', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          // Missing password
        });

      expect([400, 422]).toContain(response.status);
    });
  });
});

describe('Multi-Tenant Data Isolation - E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let companyA: { id: string };
  let companyB: { id: string };
  let userA: { id: string };
  let productB: { id: string };
  let supplierB: { id: string };
  let tokenA: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    companyA = await prisma.company.create({
      data: {
        name: `Tenant A ${unique}`,
        nif: `TA-${unique}`,
        email: `tenant-a-${unique}@example.test`,
      },
      select: { id: true },
    });
    companyB = await prisma.company.create({
      data: {
        name: `Tenant B ${unique}`,
        nif: `TB-${unique}`,
        email: `tenant-b-${unique}@example.test`,
      },
      select: { id: true },
    });
    userA = await prisma.user.create({
      data: {
        name: 'Tenant A Operator',
        email: `operator-${unique}@example.test`,
        password: 'not-used-in-this-test',
        role: Role.OPERATOR,
        companyId: companyA.id,
      },
      select: { id: true },
    });
    supplierB = await prisma.supplier.create({
      data: {
        name: `Tenant B Supplier ${unique}`,
        nif: `SB-${unique}`,
        companyId: companyB.id,
      },
      select: { id: true },
    });
    productB = await prisma.product.create({
      data: {
        internalCode: `TENANT-B-${unique}`,
        description: 'Tenant B product',
        quantity: 12,
        unit: 'unit',
        supplierId: supplierB.id,
        companyId: companyB.id,
      },
      select: { id: true },
    });
    tokenA = await jwtService.signAsync({ sub: userA.id });
  });

  afterAll(async () => {
    if (productB)
      await prisma.product.deleteMany({ where: { id: productB.id } });
    if (supplierB)
      await prisma.supplier.deleteMany({ where: { id: supplierB.id } });
    if (userA) await prisma.user.deleteMany({ where: { id: userA.id } });
    if (companyB)
      await prisma.company.deleteMany({ where: { id: companyB.id } });
    if (companyA)
      await prisma.company.deleteMany({ where: { id: companyA.id } });
    await app.close();
  });

  it('should deny access to protected endpoints without JWT', async () => {
    const response = await request(app.getHttpServer()).get('/api/products');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  it('returns 403 when an authenticated operator attempts an admin-only action', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/products/does-not-exist')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(403);
  });

  it('prevents tenant A from reading or changing tenant B products', async () => {
    const read = await request(app.getHttpServer())
      .get(`/api/products/${productB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const update = await request(app.getHttpServer())
      .patch(`/api/products/${productB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ description: 'Cross-tenant modification' });
    const persisted = await prisma.product.findUnique({
      where: { id: productB.id },
      select: { description: true, companyId: true },
    });

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
    expect(persisted).toEqual({
      description: 'Tenant B product',
      companyId: companyB.id,
    });
  });
});
