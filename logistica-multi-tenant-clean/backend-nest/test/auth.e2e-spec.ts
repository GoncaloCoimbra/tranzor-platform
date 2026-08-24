import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { createApp } from '../src/main';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const describeOrSkip = process.env.DATABASE_URL ? describe : describe.skip;

async function createSupplier(server: any, token: string, ts: number) {
  const numericNif = String(ts % 1000000000).padStart(9, '0');
  const response = await request(server)
    .post('/api/suppliers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Supplier ${ts}`,
      nif: numericNif,
      email: `supplier.${ts}@example.com`,
      phone: '+351912345678',
    });

  expect(response.status).toBe(201);
  return response.body.id;
}

describeOrSkip('Auth e2e: refresh/revoke', () => {
  let app: INestApplication;
  let server: any;
  let refreshToken: string;
  let userCompanyId: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();
  }, 20000);

  afterAll(async () => {
    if (userCompanyId) {
      await prisma.company
        .delete({ where: { id: userCompanyId } })
        .catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  test('register -> login -> refresh -> revoke', async () => {
    const ts = Date.now();
    const reg = await request(server)
      .post('/api/auth/register')
      .send({
        email: `e2e.auth.${ts}@example.com`,
        password: 'password123',
        name: 'E2E User',
      });

    expect(reg.status).toBe(201);
    expect(reg.body.refreshToken).toBeTruthy();

    refreshToken = reg.body.refreshToken;
    userCompanyId = reg.body.user.companyId;

    // Use refresh endpoint
    const refreshed = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.token).toBeTruthy();

    // Revoke
    const revoked = await request(server)
      .post('/api/auth/revoke')
      .send({ refreshToken });

    expect(revoked.status).toBe(200);
    expect(revoked.body.revoked).toBe(true);

    // Try refresh again (should fail)
    const refreshed2 = await request(server)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshed2.status).toBe(401);
  }, 30000);
});

describeOrSkip('Multi-tenant isolation', () => {
  let app: INestApplication;
  let server: any;
  let company1Token: string;
  let company2Token: string;
  let company1Id: string;
  let company2Id: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();

    // Create two companies
    const ts = Date.now();
    const reg1 = await request(server)
      .post('/api/auth/register')
      .send({
        email: `company1.${ts}@example.com`,
        password: 'password123',
        name: 'Company 1 User',
      });

    const reg2 = await request(server)
      .post('/api/auth/register')
      .send({
        email: `company2.${ts}@example.com`,
        password: 'password123',
        name: 'Company 2 User',
      });

    company1Token = reg1.body.token;
    company2Token = reg2.body.token;
    company1Id = reg1.body.user.companyId;
    company2Id = reg2.body.user.companyId;

    const supplier1Id = await createSupplier(server, company1Token, ts + 1);
    const supplier2Id = await createSupplier(server, company2Token, ts + 2);
    (global as any).companySupplierIds = { supplier1Id, supplier2Id };
  }, 20000);

  afterAll(async () => {
    if (company1Id) {
      await prisma.company
        .delete({ where: { id: company1Id } })
        .catch(() => {});
    }
    if (company2Id) {
      await prisma.company
        .delete({ where: { id: company2Id } })
        .catch(() => {});
    }
    await prisma.$disconnect();
    await app.close();
  });

  test('users from different companies cannot access each other data', async () => {
    // Company 1 creates a product
    const product1 = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${company1Token}`)
      .send({
        internalCode: 'PROD1',
        description: 'Product 1',
        quantity: 10,
        unit: 'pcs',
        supplierId: (global as any).companySupplierIds.supplier1Id,
      });

    expect(product1.status).toBe(201);
    const product1Id = product1.body.id;

    // Company 2 creates a product
    const product2 = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${company2Token}`)
      .send({
        internalCode: 'PROD2',
        description: 'Product 2',
        quantity: 20,
        unit: 'pcs',
        supplierId: (global as any).companySupplierIds.supplier2Id,
      });

    expect(product2.status).toBe(201);
    const product2Id = product2.body.id;

    // Company 1 tries to access Company 2's product (should fail)
    const accessProduct2 = await request(server)
      .get(`/api/products/${product2Id}`)
      .set('Authorization', `Bearer ${company1Token}`);

    expect(accessProduct2.status).toBe(404); // Not found because filtered by companyId

    // Company 2 tries to access Company 1's product (should fail)
    const accessProduct1 = await request(server)
      .get(`/api/products/${product1Id}`)
      .set('Authorization', `Bearer ${company2Token}`);

    expect(accessProduct1.status).toBe(404);

    // Each company can access their own products
    const accessOwn1 = await request(server)
      .get(`/api/products/${product1Id}`)
      .set('Authorization', `Bearer ${company1Token}`);

    expect(accessOwn1.status).toBe(200);
    expect(accessOwn1.body.id).toBe(product1Id);

    const accessOwn2 = await request(server)
      .get(`/api/products/${product2Id}`)
      .set('Authorization', `Bearer ${company2Token}`);

    expect(accessOwn2.status).toBe(200);
    expect(accessOwn2.body.id).toBe(product2Id);
  }, 30000);
});
