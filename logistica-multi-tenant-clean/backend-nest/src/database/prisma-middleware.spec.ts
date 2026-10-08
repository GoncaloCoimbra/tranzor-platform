import { PrismaService } from './prisma.service';
import { TenantContextService } from '../common/tenant-context.service';

describe('Prisma tenant middleware', () => {
  let prisma: PrismaService;
  let tenantContext: TenantContextService;

  beforeAll(async () => {
    tenantContext = new TenantContextService();
    prisma = new PrismaService(tenantContext);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('should inject companyId into ProductMovement and TransportProduct writes', async () => {
    const ts = Date.now();

    const company = await prisma.company.create({
      data: {
        name: `Middleware Test Company ${ts}`,
        nif: `MID-${ts}`,
        email: `middleware-${ts}@example.com`,
      },
    });

    const supplier = await prisma.supplier.create({
      data: {
        name: `Supplier ${ts}`,
        nif: `SUP-${ts}`,
        companyId: company.id,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `user-${ts}@example.com`,
        name: `User ${ts}`,
        password: 'hashed-password',
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    const product = await prisma.product.create({
      data: {
        internalCode: `MID-SKU-${ts}`,
        description: 'Middleware test product',
        quantity: 10,
        unit: 'unit',
        supplierId: supplier.id,
        companyId: company.id,
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        licensePlate: `MID-${ts.toString().slice(-6)}`,
        type: 'Van',
        model: 'Model X',
        brand: 'Brand X',
        capacity: 1500,
        year: 2024,
        companyId: company.id,
      },
    });

    const transport = await prisma.transport.create({
      data: {
        internalCode: `MID-TR-${ts}`,
        vehicleId: vehicle.id,
        origin: 'Lisboa',
        destination: 'Porto',
        departureDate: new Date(),
        estimatedArrival: new Date(Date.now() + 86400000),
        totalWeight: 1200,
        companyId: company.id,
      },
    });

    const createdMovement = await tenantContext.run(
      { companyId: company.id, userId: user.id },
      async () =>
        prisma.productMovement.create({
          data: {
            productId: product.id,
            companyId: company.id,
            previousStatus: 'RECEIVED',
            newStatus: 'IN_STORAGE',
            quantity: 2,
            location: 'Warehouse A',
            userId: user.id,
          },
        }),
    );

    const createdTransportProduct = await tenantContext.run(
      { companyId: company.id, userId: user.id },
      async () =>
        prisma.transportProduct.create({
          data: {
            transportId: transport.id,
            productId: product.id,
            companyId: company.id,
            quantity: 1,
          },
        }),
    );

    expect(createdMovement.companyId).toBe(company.id);
    expect(createdTransportProduct.companyId).toBe(company.id);

    const persistedMovement = await prisma.productMovement.findUnique({
      where: { id: createdMovement.id },
    });

    const persistedTransportProduct = await prisma.transportProduct.findUnique({
      where: { id: createdTransportProduct.id },
    });

    expect(persistedMovement?.companyId).toBe(company.id);
    expect(persistedTransportProduct?.companyId).toBe(company.id);

    await prisma.productMovement.deleteMany({
      where: { id: createdMovement.id },
    });
    await prisma.transportProduct.deleteMany({
      where: { id: createdTransportProduct.id },
    });
    await prisma.transport.deleteMany({ where: { id: transport.id } });
    await prisma.vehicle.deleteMany({ where: { id: vehicle.id } });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.supplier.deleteMany({ where: { id: supplier.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
  });
});
