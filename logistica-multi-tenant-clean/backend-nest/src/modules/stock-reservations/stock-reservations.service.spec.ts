import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StockReservationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RedisLockService } from './redis-lock.service';
import { StockReservationsService } from './stock-reservations.service';
import { AppGateway } from '../../app.gateway';
import { ListStockReservationsDto } from './dto/list-stock-reservations.dto';

describe('StockReservationsService', () => {
  let service: StockReservationsService;
  let prisma: PrismaService;
  let redisLockService: {
    acquireLock: jest.Mock;
    releaseLock: jest.Mock;
  };
  let appGateway: {
    emitToCompany: jest.Mock;
  };

  beforeEach(async () => {
    redisLockService = {
      acquireLock: jest.fn().mockResolvedValue('lock-token'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    appGateway = {
      emitToCompany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockReservationsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            stockReservation: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              aggregate: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn(),
            transport: {
              findFirst: jest.fn().mockResolvedValue({ id: 'transport-1' }),
            },
          },
        },
        {
          provide: RedisLockService,
          useValue: redisLockService,
        },
        {
          provide: AppGateway,
          useValue: appGateway,
        },
      ],
    }).compile();

    service = module.get<StockReservationsService>(StockReservationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a RESERVED reservation with a default expiration TTL', async () => {
    const mockReservation = {
      id: 'res-1',
      companyId: 'company-1',
      productId: 'product-1',
      transportId: 'transport-1',
      quantity: 5,
      status: StockReservationStatus.RESERVED,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      quantity: 10,
    });
    (prisma.stockReservation.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 0 },
    });
    (prisma.stockReservation.create as jest.Mock).mockResolvedValue(
      mockReservation,
    );

    const result = await service.createReservation(
      'company-1',
      'product-1',
      5,
      'transport-1',
    );

    expect(redisLockService.acquireLock).toHaveBeenCalledWith(
      'stock:lock:company-1:product-1',
    );
    expect(prisma.stockReservation.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        productId: 'product-1',
        transportId: 'transport-1',
        quantity: 5,
        status: StockReservationStatus.RESERVED,
        expiresAt: expect.any(Date),
      },
    });
    expect(redisLockService.releaseLock).toHaveBeenCalledWith(
      'stock:lock:company-1:product-1',
      'lock-token',
    );
    expect(result.status).toBe(StockReservationStatus.RESERVED);
    expect(appGateway.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'stock:reservation-created',
      expect.objectContaining({
        companyId: 'company-1',
        reservationId: 'res-1',
        productId: 'product-1',
        quantity: 5,
        status: StockReservationStatus.RESERVED,
        timestamp: expect.any(String),
      }),
    );
    expect(appGateway.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'stock:updated',
      expect.objectContaining({
        companyId: 'company-1',
        productId: 'product-1',
        availableQuantity: 10,
      }),
    );
  });

  it('lists reservations with pagination and tenant-scoped filters', async () => {
    const query: ListStockReservationsDto = {
      page: 2,
      limit: 10,
      status: StockReservationStatus.CONFIRMED,
      productId: 'product-1',
      transportId: 'transport-1',
    };
    const reservations = [{ id: 'res-1', companyId: 'company-a' }];

    (prisma.stockReservation.findMany as jest.Mock).mockResolvedValue(
      reservations,
    );
    (prisma.stockReservation.count as jest.Mock).mockResolvedValue(1);

    await expect(service.findAll('company-a', query)).resolves.toEqual({
      data: reservations,
      total: 1,
      page: 2,
      limit: 10,
    });

    expect(prisma.stockReservation.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-a',
        status: StockReservationStatus.CONFIRMED,
        productId: 'product-1',
        transportId: 'transport-1',
      },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { product: true, transport: true },
    });
    expect(prisma.stockReservation.count).toHaveBeenCalledWith({
      where: {
        companyId: 'company-a',
        status: StockReservationStatus.CONFIRMED,
        productId: 'product-1',
        transportId: 'transport-1',
      },
    });
  });

  it('does not expose a reservation owned by another company', async () => {
    (prisma.stockReservation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne('reservation-a', 'company-b')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.stockReservation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'reservation-a',
        companyId: 'company-b',
      },
      include: { product: true, transport: true },
    });
  });

  it('emits reservation:created exactly once outside a transaction', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      quantity: 10,
    });
    (prisma.stockReservation.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 0 },
    });
    (prisma.stockReservation.create as jest.Mock).mockResolvedValue({
      id: 'res-outside-1',
      companyId: 'company-1',
      productId: 'product-1',
      quantity: 2,
      status: StockReservationStatus.RESERVED,
      transportId: null,
    });

    await service.createReservation('company-1', 'product-1', 2);

    const reservationCreatedEvents = appGateway.emitToCompany.mock.calls.filter(
      ([companyId, event]) =>
        companyId === 'company-1' && event === 'stock:reservation-created',
    );

    expect(reservationCreatedEvents).toHaveLength(1);
    expect(reservationCreatedEvents[0][2]).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        reservationId: 'res-outside-1',
        productId: 'product-1',
        status: StockReservationStatus.RESERVED,
      }),
    );
  });

  it('should confirm a RESERVED reservation', async () => {
    const mockReservation = {
      id: 'res-1',
      companyId: 'company-1',
      productId: 'product-1',
      transportId: 'transport-1',
      quantity: 5,
      status: StockReservationStatus.RESERVED,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    (prisma.stockReservation.findFirst as jest.Mock).mockResolvedValue(
      mockReservation,
    );
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      quantity: 10,
    });
    (prisma.stockReservation.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 5 },
    });
    (prisma.stockReservation.update as jest.Mock).mockResolvedValue({
      ...mockReservation,
      status: StockReservationStatus.CONFIRMED,
      confirmedAt: new Date(),
    });

    const result = await service.confirmReservation('res-1', 'company-1');

    expect(prisma.stockReservation.update).toHaveBeenCalledWith({
      where: { id: 'res-1', companyId: 'company-1' },
      data: {
        status: StockReservationStatus.CONFIRMED,
        confirmedAt: expect.any(Date),
      },
    });
    expect(result.status).toBe(StockReservationStatus.CONFIRMED);
    expect(appGateway.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'stock:reservation-confirmed',
      expect.objectContaining({
        reservationId: 'res-1',
        productId: 'product-1',
        quantity: 5,
        status: StockReservationStatus.CONFIRMED,
        timestamp: expect.any(String),
      }),
    );
    expect(appGateway.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'stock:updated',
      expect.objectContaining({
        productId: 'product-1',
        availableQuantity: 5,
      }),
    );
  });

  it('should release a CONFIRMED reservation', async () => {
    const mockReservation = {
      id: 'res-1',
      companyId: 'company-1',
      productId: 'product-1',
      transportId: 'transport-1',
      quantity: 5,
      status: StockReservationStatus.CONFIRMED,
      confirmedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    (prisma.stockReservation.findFirst as jest.Mock).mockResolvedValue(
      mockReservation,
    );
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      quantity: 10,
    });
    (prisma.stockReservation.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 0 },
    });
    (prisma.stockReservation.update as jest.Mock).mockResolvedValue({
      ...mockReservation,
      status: StockReservationStatus.RELEASED,
      releasedAt: new Date(),
    });

    const result = await service.releaseReservation('res-1', 'company-1');

    expect(prisma.stockReservation.update).toHaveBeenCalledWith({
      where: { id: 'res-1', companyId: 'company-1' },
      data: {
        status: StockReservationStatus.RELEASED,
        releasedAt: expect.any(Date),
      },
    });
    expect(result.status).toBe(StockReservationStatus.RELEASED);
    expect(appGateway.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'stock:reservation-released',
      expect.objectContaining({
        reservationId: 'res-1',
        productId: 'product-1',
        quantity: 5,
        status: StockReservationStatus.RELEASED,
        timestamp: expect.any(String),
      }),
    );
  });

  it('should reject invalid transitions', async () => {
    (prisma.stockReservation.findFirst as jest.Mock).mockResolvedValue({
      id: 'res-1',
      companyId: 'company-1',
      status: StockReservationStatus.RELEASED,
      quantity: 5,
      productId: 'product-1',
    });

    await expect(
      service.confirmReservation('res-1', 'company-1'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.confirmReservation('res-1', 'company-1'),
    ).rejects.toThrow(
      'Only RESERVED reservations can transition to CONFIRMED.',
    );
  });

  it('should reject unknown reservations', async () => {
    (prisma.stockReservation.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.confirmReservation('missing', 'company-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject cross-company confirmation attempts', async () => {
    const reservationForCompanyA = {
      id: 'res-1',
      companyId: 'company-a',
      productId: 'product-1',
      quantity: 5,
      status: StockReservationStatus.RESERVED,
      transportId: 'transport-1',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    (prisma.stockReservation.findFirst as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: string; companyId: string } }) => {
        if (where.id === 'res-1' && where.companyId === 'company-a') {
          return reservationForCompanyA;
        }

        return null;
      },
    );

    await expect(
      service.confirmReservation('res-1', 'company-b'),
    ).rejects.toThrow(
      'Stock reservation res-1 not found for company company-b.',
    );

    expect(prisma.stockReservation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'res-1',
        companyId: 'company-b',
      },
    });
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
  });

  it('should reject cross-company release attempts', async () => {
    const reservationForCompanyA = {
      id: 'res-1',
      companyId: 'company-a',
      productId: 'product-1',
      quantity: 5,
      status: StockReservationStatus.RESERVED,
      transportId: 'transport-1',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    (prisma.stockReservation.findFirst as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: string; companyId: string } }) => {
        if (where.id === 'res-1' && where.companyId === 'company-a') {
          return reservationForCompanyA;
        }

        return null;
      },
    );

    await expect(
      service.releaseReservation('res-1', 'company-b'),
    ).rejects.toThrow(
      'Stock reservation res-1 not found for company company-b.',
    );

    expect(prisma.stockReservation.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'res-1',
        companyId: 'company-b',
      },
    });
    expect(prisma.stockReservation.update).not.toHaveBeenCalled();
  });

  it('should prevent overselling under concurrent createReservation calls', async () => {
    const productQuantity = 10;
    let lockHeld = false;

    redisLockService.acquireLock.mockImplementation(async () => {
      if (lockHeld) {
        return null;
      }

      lockHeld = true;
      return 'lock-token';
    });

    redisLockService.releaseLock.mockImplementation(async () => {
      lockHeld = false;
      return true;
    });

    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      quantity: productQuantity,
    });

    (prisma.stockReservation.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 0 },
    });

    const createMock = prisma.stockReservation.create as jest.Mock;

    createMock.mockImplementation(async ({ data }) => {
      return {
        id: `res-${Date.now()}-${Math.random()}`,
        ...data,
      };
    });

    const requests = [
      service.createReservation('company-1', 'product-1', 8),
      service.createReservation('company-1', 'product-1', 8),
      service.createReservation('company-1', 'product-1', 8),
    ];

    const results = await Promise.allSettled(requests);

    const createdSuccesses = results.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const conflictCount = results.filter(
      (r) =>
        r.status === 'rejected' &&
        r.reason instanceof ConflictException &&
        r.reason.message.includes('Redis lock unavailable'),
    ).length;

    expect(createdSuccesses).toBe(1);
    expect(conflictCount).toBe(2);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(redisLockService.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('should tolerate floating-point rounding when checking available stock', async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      quantity: 0.3,
    });

    (prisma.stockReservation.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 0.1 },
    });

    (prisma.stockReservation.create as jest.Mock).mockResolvedValueOnce({
      id: 'res-1',
      companyId: 'company-1',
      productId: 'product-1',
      quantity: 0.2,
      status: StockReservationStatus.RESERVED,
    });

    await expect(
      service.createReservation('company-1', 'product-1', 0.2),
    ).resolves.toMatchObject({
      companyId: 'company-1',
      productId: 'product-1',
      quantity: 0.2,
    });

    await expect(
      service.createReservation('company-1', 'product-1', 0.21),
    ).rejects.toThrow(ConflictException);
  });

  it('should expire only overdue RESERVED reservations', async () => {
    const expiredReservations = [
      {
        id: 'res-1',
        companyId: 'company-1',
        productId: 'product-1',
        quantity: 2,
        status: StockReservationStatus.RESERVED,
        transportId: null,
      },
      {
        id: 'res-2',
        companyId: 'company-1',
        productId: 'product-2',
        quantity: 3,
        status: StockReservationStatus.RESERVED,
        transportId: null,
      },
    ];
    (prisma.stockReservation.findMany as jest.Mock).mockResolvedValue(
      expiredReservations,
    );
    (prisma.stockReservation.updateMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma as any).$transaction.mockImplementation(async (callback) =>
      callback({
        stockReservation: {
          findMany: prisma.stockReservation.findMany,
          updateMany: prisma.stockReservation.updateMany,
        },
      }),
    );
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      quantity: 10,
    });
    (prisma.stockReservation.aggregate as jest.Mock).mockResolvedValue({
      _sum: { quantity: 0 },
    });

    await expect(service.expireReservations()).resolves.toBe(2);

    expect(prisma.stockReservation.updateMany).toHaveBeenCalledTimes(2);
    expect(appGateway.emitToCompany).toHaveBeenCalledTimes(4);
    expect(appGateway.emitToCompany).toHaveBeenCalledWith(
      'company-1',
      'stock:reservation-expired',
      expect.objectContaining({
        reservationId: 'res-1',
        status: StockReservationStatus.EXPIRED,
      }),
    );
  });
});
