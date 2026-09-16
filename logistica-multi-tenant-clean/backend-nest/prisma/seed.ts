import { PrismaClient, ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isStrongPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword || !isStrongPassword(superAdminPassword)) {
    throw new Error('SUPER_ADMIN_EMAIL and a strong SUPER_ADMIN_PASSWORD are required to run the seed');
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Referral", "Task", "RefreshToken", "Notification", "Settings", "AuditLog", "StockReservation", "TransportProduct", "Transport", "ProductMovement", "Product", "Vehicle", "Supplier", "User", "ApiKey", "Company" RESTART IDENTITY CASCADE`);

  const passwordHash = await bcrypt.hash('UserPass1', 10);
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);
  const legacyAdminHash = await bcrypt.hash('admin123', 10);
  const legacyOperatorHash = await bcrypt.hash('operator123', 10);

  const logistics = await prisma.company.create({
    data: {
      name: 'Logistics Demo Ltd',
      nif: '500000001',
      email: 'company@logistics.com',
      phone: '+351 220 000 001',
      address: 'Rua da Logistica, 1, Porto',
    },
  });
  const transporto = await prisma.company.create({
    data: {
      name: 'TransPorto Express',
      nif: '500000002',
      email: 'company@transporto.com',
      phone: '+351 220 000 002',
      address: 'Avenida dos Transportes, 2, Porto',
    },
  });

  await prisma.user.create({
    data: {
      name: 'Super Admin',
      email: superAdminEmail,
      password: superAdminHash,
      role: Role.SUPER_ADMIN,
      companyId: null,
    },
  });
  await prisma.user.create({
    data: {
      name: 'Admin Demo',
      email: 'admin@logistica.com',
      password: legacyAdminHash,
      role: Role.ADMIN,
      companyId: logistics.id,
    },
  });
  await prisma.user.create({
    data: {
      name: 'Operator Demo',
      email: 'operator@logistica.com',
      password: legacyOperatorHash,
      role: Role.OPERATOR,
      companyId: logistics.id,
    },
  });
  const logisticsUser = await prisma.user.create({
    data: {
      name: 'Logistics User',
      email: 'user@logistics.com',
      password: passwordHash,
      role: Role.ADMIN,
      companyId: logistics.id,
    },
  });
  await prisma.user.create({
    data: {
      name: 'TransPorto User',
      email: 'user@transporto.com',
      password: passwordHash,
      role: Role.ADMIN,
      companyId: transporto.id,
    },
  });

  const supplierLogistics = await prisma.supplier.create({
    data: {
      name: 'Logistics Supplier',
      nif: '501000001',
      email: 'supplier@logistics.com',
      companyId: logistics.id,
    },
  });
  const supplierTransporto = await prisma.supplier.create({
    data: {
      name: 'TransPorto Supplier',
      nif: '501000002',
      email: 'supplier@transporto.com',
      companyId: transporto.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      licensePlate: 'LD-01-AA',
      type: 'Truck',
      model: 'Actros',
      brand: 'Mercedes',
      capacity: 10000,
      year: 2023,
      companyId: logistics.id,
    },
  });
  await prisma.vehicle.create({
    data: {
      licensePlate: 'TP-02-BB',
      type: 'Van',
      model: 'Sprinter',
      brand: 'Mercedes',
      capacity: 3500,
      year: 2024,
      companyId: transporto.id,
    },
  });

  await prisma.product.createMany({
    data: [
      { internalCode: 'LOG-001', description: 'Control panel', quantity: 10, unit: 'UN', status: ProductStatus.RECEIVED, supplierId: supplierLogistics.id, companyId: logistics.id },
      { internalCode: 'LOG-002', description: 'Hydraulic pump', quantity: 5, unit: 'UN', status: ProductStatus.IN_STORAGE, supplierId: supplierLogistics.id, companyId: logistics.id },
      { internalCode: 'LOG-003', description: 'Industrial lubricant', quantity: 25, unit: 'L', status: ProductStatus.IN_ANALYSIS, supplierId: supplierLogistics.id, companyId: logistics.id },
      { internalCode: 'TP-001', description: 'Packaging material', quantity: 100, unit: 'UN', status: ProductStatus.RECEIVED, supplierId: supplierTransporto.id, companyId: transporto.id },
      { internalCode: 'TP-002', description: 'Wooden pallets', quantity: 50, unit: 'UN', status: ProductStatus.APPROVED, supplierId: supplierTransporto.id, companyId: transporto.id },
    ],
  });

  console.log(JSON.stringify({
    companies: 2,
    users: 6,
    products: 5,
    suppliers: 2,
    vehicles: 2,
    loginUsers: [
      superAdminEmail,
      'admin@logistica.com / admin123',
      'operator@logistica.com / operator123',
      logisticsUser.email,
      'user@transporto.com',
    ],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
