import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/main';
import { INestApplication } from '@nestjs/common';

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

describeOrSkip('Transports e2e', () => {
  let app: INestApplication;
  let server: any;
  let companyId: string;
  let token: string;
  let productId: string;
  let transportId: string;
  let vehicleId: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();

    // register company & admin
    const ts = Date.now();
    const res = await request(server)
      .post('/api/auth/registration/company')
      .send({
        companyName: `E2E Transport Co ${ts}`,
        companyNif: `NIFT${ts}`,
        companyEmail: `e2e.transport.${ts}@example.com`,
        userName: 'E2E Admin',
        userEmail: `e2e.transport.admin.${ts}@example.com`,
        userPassword: 'password123',
      });

    token = res.body.token;
    companyId = res.body.user.companyId;

    const supplierId = await createSupplier(server, token, ts + 1);

    // create a product
    const p = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        internalCode: `TP-${ts}`,
        description: 'Transport product',
        quantity: 1,
        unit: 'pcs',
        supplierId,
      });

    productId = p.body.id;

    // create a vehicle to use in the transport
    const v = await request(server)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        licensePlate: `E2E-${ts}`,
        model: 'Van',
        brand: 'Make',
        type: 'van',
        capacity: 1000,
        year: 2020,
      });

    expect(v.status).toBe(201);
    vehicleId = v.body.id;
  }, 30000);

  afterAll(async () => {
    if (transportId)
      await prisma.transport
        .delete({ where: { id: transportId } })
        .catch(() => {});
    if (productId)
      await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    if (companyId)
      await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    await prisma.$disconnect();
    await app.close();
  });

  test('create transport, add product and set delivered', async () => {
    const createTransport = await request(server)
      .post('/api/transports')
      .set('Authorization', `Bearer ${token}`)
      .send({
        vehicleId,
        origin: 'Warehouse A',
        destination: 'Client B',
        departureDate: new Date().toISOString().slice(0, 10),
        estimatedArrival: new Date(Date.now() + 24 * 3600 * 1000)
          .toISOString()
          .slice(0, 10),
        totalWeight: 0,
      });

    expect(createTransport.status).toBe(201);
    transportId = createTransport.body.id;

    // add product to transport
    const addRes = await request(server)
      .post(`/api/transports/${transportId}/add-product`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    expect(addRes.status).toBe(201);

    // mark transport as IN_TRANSIT
    const inTransit = await request(server)
      .patch(`/api/transports/${transportId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_TRANSIT' });

    expect(inTransit.status).toBe(200);

    const arrived = await request(server)
      .patch(`/api/transports/${transportId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ARRIVED' });

    expect(arrived.status).toBe(200);

    const delivered = await request(server)
      .patch(`/api/transports/${transportId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DELIVERED' });

    expect(delivered.status).toBe(200);

    // fetch transport and ensure status is DELIVERED
    const get = await request(server)
      .get(`/api/transports/${transportId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(get.status).toBe(200);
    expect(get.body.status).toBe('DELIVERED');
  }, 40000);
});
