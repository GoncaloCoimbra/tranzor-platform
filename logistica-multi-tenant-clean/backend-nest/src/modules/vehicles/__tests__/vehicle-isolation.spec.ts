import { TransportStatus } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { VehicleRepository } from '../../../database/repositories/vehicle.repository';
import { TransportsService } from '../../transports/transports.service';
import { NotFoundException } from '@nestjs/common';

describe('Vehicle isolation across companies', () => {
  let prisma: PrismaService;
  let companyA: any;
  let companyB: any;
  let vehicleA: any;
  let transportA: any;

  beforeAll(async () => {
    prisma = new PrismaService(new TenantContextService());
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    try {
      if (transportA) {
        await prisma.transport.deleteMany({ where: { id: transportA.id } });
      }

      if (vehicleA) {
        await prisma.vehicle.deleteMany({ where: { id: vehicleA.id } });
      }

      if (companyA) {
        await prisma.company.deleteMany({ where: { id: companyA.id } });
      }

      if (companyB) {
        await prisma.company.deleteMany({ where: { id: companyB.id } });
      }
    } finally {
      await prisma.onModuleDestroy();
    }
  });

  it('should prevent company B from seeing or affecting company A vehicle/transport data', async () => {
    const ts = Date.now();
    const companyAName = `Company A ${ts}`;
    const companyBName = `Company B ${ts}`;

    companyA = await prisma.company.create({
      data: {
        name: companyAName,
        nif: `A-${ts}-001`,
        email: `a-${ts}@example.com`,
        phone: '+351000000001',
        address: 'Avenida A',
      },
    });

    companyB = await prisma.company.create({
      data: {
        name: companyBName,
        nif: `B-${ts}-001`,
        email: `b-${ts}@example.com`,
        phone: '+351000000002',
        address: 'Avenida B',
      },
    });

    vehicleA = await prisma.vehicle.create({
      data: {
        licensePlate: `AB-${ts.toString().slice(-6)}`,
        type: 'Van',
        model: 'Model X',
        brand: 'Brand X',
        capacity: 1500,
        year: 2024,
        status: 'available',
        companyId: companyA.id,
      },
    });

    transportA = await prisma.transport.create({
      data: {
        internalCode: `TRP-${ts}`,
        vehicleId: vehicleA.id,
        origin: 'Lisboa',
        destination: 'Porto',
        departureDate: new Date(),
        estimatedArrival: new Date(Date.now() + 86400000),
        totalWeight: 1200,
        companyId: companyA.id,
        status: TransportStatus.PENDING,
      },
    });

    console.log('=== REAL ISOLATION TEST SETUP ===');
    console.log('companyA.id =', companyA.id);
    console.log('companyB.id =', companyB.id);
    console.log('vehicleA.id =', vehicleA.id);
    console.log('vehicleA.licensePlate =', vehicleA.licensePlate);
    console.log('transportA.id =', transportA.id);
    console.log('transportA.companyId =', transportA.companyId);

    const vehicleRepository = new VehicleRepository(prisma);

    console.log('\n--- company B repository queries ---');

    const companyBFindAll = await vehicleRepository.findAll(companyB.id);
    console.log('vehicleRepository.findAll(companyB.id) =>', companyBFindAll);

    const companyBFindById = await vehicleRepository.findById(
      vehicleA.id,
      companyB.id,
    );
    console.log(
      'vehicleRepository.findById(vehicleA.id, companyB.id) =>',
      companyBFindById,
    );

    const companyBFindOne = await vehicleRepository.findOne(
      vehicleA.id,
      companyB.id,
    );
    console.log(
      'vehicleRepository.findOne(vehicleA.id, companyB.id) =>',
      companyBFindOne,
    );

    const companyBFindByLicensePlate =
      await vehicleRepository.findByLicensePlate(
        vehicleA.licensePlate,
        companyB.id,
      );
    console.log(
      'vehicleRepository.findByLicensePlate(vehicleA.licensePlate, companyB.id) =>',
      companyBFindByLicensePlate,
    );

    console.log('\n--- company B checkVehicleAvailability() ---');

    const transportsService = new TransportsService(
      prisma,
      {
        notifyTransportDelivered: jest.fn(),
        create: jest.fn(),
      } as any,
      {
        log: jest.fn(),
      } as any,
      {} as any,
      {} as any,
    );

    let checkAvailabilityError: any = undefined;

    try {
      await (transportsService as any).checkVehicleAvailability(
        vehicleA.id,
        companyB.id,
      );
      console.log(
        'checkVehicleAvailability(vehicleA.id, companyB.id) unexpectedly succeeded',
      );
    } catch (error) {
      checkAvailabilityError = error;
      console.log(
        'checkVehicleAvailability(vehicleA.id, companyB.id) threw =>',
        error.constructor?.name,
        error.message,
      );
    }

    expect(companyBFindAll).toEqual([]);
    expect(companyBFindById).toBeNull();
    expect(companyBFindOne).toBeNull();
    expect(companyBFindByLicensePlate).toBeNull();
    expect(checkAvailabilityError).toBeInstanceOf(NotFoundException);
    expect(checkAvailabilityError.message).toContain(
      'Vehicle not found or does not belong to this company',
    );

    console.log('\n=== REAL ISOLATION TEST SUMMARY ===');
    console.log(
      'Company B can only see zero vehicles and zero matches for company A data.',
    );
  });
});
