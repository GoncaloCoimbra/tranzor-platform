import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { TransportsService } from '../transports.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { StockReservationsService } from '../../stock-reservations/stock-reservations.service';
import { AppGateway } from '../../../app.gateway';
import { TransportStatus } from '@prisma/client';
import { ListTransportsDto } from '../dto/list-transports.dto';

describe('TransportsService', () => {
  let service: TransportsService;
  let prismaService: PrismaService;
  let appGateway: {
    emitToCompany: jest.Mock;
  };
  let stockReservationsService: {
    createReservation: jest.Mock;
    confirmReservationsForTransport: jest.Mock;
    releaseReservationsForTransport: jest.Mock;
    emitReservationEvent: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransportsService,
        {
          provide: PrismaService,
          useValue: {
            transport: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            company: {
              findUnique: jest.fn(),
            },
            vehicle: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            product: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            transportProduct: {
              create: jest.fn(),
              deleteMany: jest.fn(),
            },
            stockReservation: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            productMovement: {
              create: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback({})),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifyTransportDelivered: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: StockReservationsService,
          useValue: {
            createReservation: jest.fn(),
            confirmReservationsForTransport: jest.fn(),
            releaseReservationsForTransport: jest.fn(),
            emitReservationEvent: jest.fn(),
          },
        },
        {
          provide: AppGateway,
          useValue: {
            emitToCompany: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransportsService>(TransportsService);
    prismaService = module.get<PrismaService>(PrismaService);
    appGateway = module.get(AppGateway);
    stockReservationsService = module.get(StockReservationsService);
  });

  describe('getTrackingRoutes', () => {
    it('should return tracking routes with valid coordinates', async () => {
      // Arrange
      const mockTransport = {
        id: '1',
        internalCode: 'TRP-000001',
        origin: 'Lisboa',
        destination: 'Porto',
        status: 'IN_TRANSIT',
        departureDate: new Date(),
        estimatedArrival: new Date(Date.now() + 86400000),
        actualArrival: null,
        vehicle: { licensePlate: 'AA-00-AA' },
        company: { id: 'comp-1' },
      };

      (prismaService.transport.findMany as jest.Mock).mockResolvedValue([
        mockTransport,
      ]);

      // Act
      const result = await service.getTrackingRoutes();

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify coordinates are numbers
      const route = result[0];
      expect(route.locations).toBeDefined();
      expect(Array.isArray(route.locations)).toBe(true);
      expect(route.locations.length).toBe(3);

      if (route.locations.length > 0) {
        const location = route.locations[0];
        expect(typeof location.lat).toBe('number');
        expect(typeof location.lng).toBe('number');
      }
    });

    it('should handle transports with missing coordinates', async () => {
      // Arrange
      const mockTransport = {
        id: '1',
        transportId: 'TRN-001',
        name: 'Transport with Unknown City',
        origin: 'UnknownCity123',
        destination: 'AnotherUnknownCity456',
        departureDate: new Date(),
        estimatedArrival: new Date(Date.now() + 3600000), // 1 hour later
        status: 'pending',
      };

      (prismaService.transport.findMany as jest.Mock).mockResolvedValue([
        mockTransport,
      ]);

      // Act
      const result = await service.getTrackingRoutes();

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should still provide fallback coordinates
      if (result.length > 0) {
        expect(result[0].locations).toBeDefined();
      }
    });

    it('should return valid route objects with required fields', async () => {
      // Arrange
      const mockTransport = {
        id: '1',
        transportId: 'TRN-001',
        name: 'Transport 1',
        origin: 'Lisboa',
        destination: 'Porto',
        departureDate: new Date(),
        estimatedArrival: new Date(Date.now() + 3600000),
        status: 'completed',
        company: {
          id: 'comp-1',
          name: 'Transport Company',
        },
      };

      (prismaService.transport.findMany as jest.Mock).mockResolvedValue([
        mockTransport,
      ]);

      // Act
      const result = await service.getTrackingRoutes();

      // Assert
      expect(result).toBeDefined();
      if (result.length > 0) {
        const route = result[0];
        expect(route.id).toBeDefined();
        expect(route.status).toBeDefined();
        expect(route.locations).toBeDefined();
        expect(route.origin_lat).toBeDefined();
        expect(route.origin_lng).toBeDefined();
        expect(route.destination_lat).toBeDefined();
        expect(route.destination_lng).toBeDefined();
      }
    });
  });

  describe('getCityCoordinates', () => {
    it('should return correct coordinates for known Portuguese cities', () => {
      // Test Lisboa
      const lisbonCoords = service['getCityCoordinates']('Lisboa');
      expect(lisbonCoords).toBeDefined();
      expect(lisbonCoords.lat).toBeDefined();
      expect(lisbonCoords.lng).toBeDefined();
      expect(typeof lisbonCoords.lat).toBe('number');
      expect(typeof lisbonCoords.lng).toBe('number');

      // Should be near actual Lisboa coordinates
      expect(lisbonCoords.lat).toBeGreaterThan(38);
      expect(lisbonCoords.lat).toBeLessThan(39);
    });

    it('should handle case-insensitive city names', () => {
      // Arrange
      const cityVariations = ['lisboa', 'LISBOA', 'Lisboa', 'LiSbOa'];

      // Act & Assert
      cityVariations.forEach((city) => {
        const coords = service['getCityCoordinates'](city);
        expect(coords).toBeDefined();
        expect(typeof coords.lat).toBe('number');
        expect(typeof coords.lng).toBe('number');
      });
    });

    it('should return fallback coordinates for unknown cities', () => {
      // Arrange
      const unknownCity = 'NonExistentCity123';

      // Act
      const coords = service['getCityCoordinates'](unknownCity);

      // Assert
      expect(coords).toBeDefined();
      expect(typeof coords.lat).toBe('number');
      expect(typeof coords.lng).toBe('number');
      // Should return Lisboa or Portugal center as fallback
      expect(coords.lat).toBeGreaterThan(38);
    });
  });

  describe('findOne', () => {
    it('should find transport by id', async () => {
      // Arrange
      const mockTransport = {
        id: '1',
        internalCode: 'TRP-000001',
        origin: 'Lisboa',
        destination: 'Porto',
      };

      (prismaService.transport.findFirst as jest.Mock).mockResolvedValue(
        mockTransport,
      );

      // Act
      const result = await service.findOne('1');

      // Assert
      expect(result).toEqual(mockTransport);
      expect(prismaService.transport.findFirst).toHaveBeenCalled();
    });
  });

  it('returns paginated transports with tenant filters and ordering', async () => {
    const query: ListTransportsDto = {
      page: 2,
      limit: 10,
      status: TransportStatus.IN_TRANSIT,
      sortBy: 'departureDate',
      order: 'asc',
    };
    const transports = [{ id: 'transport-1' }];

    (prismaService.transport.findMany as jest.Mock).mockResolvedValue(
      transports,
    );
    (prismaService.transport.count as jest.Mock).mockResolvedValue(11);

    await expect(service.findAll('company-1', query)).resolves.toEqual({
      data: transports,
      total: 11,
      page: 2,
      limit: 10,
    });

    expect(prismaService.transport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', status: TransportStatus.IN_TRANSIT },
        skip: 10,
        take: 10,
        orderBy: { departureDate: 'asc' },
      }),
    );
    expect(prismaService.transport.count).toHaveBeenCalledWith({
      where: { companyId: 'company-1', status: TransportStatus.IN_TRANSIT },
    });
  });

  describe('stock reservation lifecycle', () => {
    it('creates only transports covered by stock under concurrent create calls', async () => {
      const stockQuantity = 10;
      let reservedQuantity = 0;
      let nextTransportId = 1;
      const committedTransports: string[] = [];

      stockReservationsService.createReservation.mockImplementation(
        async (
          _companyId: string,
          _productId: string,
          quantity: number,
          transportId: string,
        ) => {
          if (reservedQuantity + quantity > stockQuantity) {
            throw new ConflictException('Insufficient stock');
          }

          reservedQuantity += quantity;
          return { id: `reservation-${transportId}` };
        },
      );

      (prismaService.vehicle.findFirst as jest.Mock).mockResolvedValue({
        capacity: 1000,
        status: 'available',
        licensePlate: 'AA-00-AA',
        model: 'Van',
      });
      (prismaService.transport.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.product.findFirst as jest.Mock).mockResolvedValue({
        id: 'product-1',
        quantity: stockQuantity,
        internalCode: 'SKU-1',
      });

      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const transportId = `transport-${nextTransportId++}`;
          const tx = {
            transport: {
              create: jest.fn().mockResolvedValue({
                id: transportId,
                internalCode: `TRP-${transportId}`,
                vehicle: { licensePlate: 'AA-00-AA' },
                company: { id: 'company-1' },
              }),
            },
            transportProduct: { create: jest.fn() },
            product: {
              update: jest.fn().mockResolvedValue({
                status: 'DISPATCHED',
                quantity: stockQuantity,
              }),
            },
            productMovement: { create: jest.fn() },
            vehicle: { update: jest.fn() },
          };

          const result = await callback(tx);
          committedTransports.push(transportId);
          return result;
        },
      );

      const createRequest = (vehicleId: string) =>
        service.create(
          {
            vehicleId,
            origin: 'Lisboa',
            destination: 'Porto',
            departureDate: '2026-09-15',
            estimatedArrival: '2026-09-16',
            totalWeight: 100,
            products: [{ productId: 'product-1', quantity: 6 }],
          } as any,
          'company-1',
          'user-1',
        );

      const results = await Promise.allSettled([
        createRequest('vehicle-1'),
        createRequest('vehicle-2'),
        createRequest('vehicle-3'),
      ]);

      const successfulCreates = results.filter(
        (result) => result.status === 'fulfilled',
      );
      const failedCreates = results.filter(
        (result) =>
          result.status === 'rejected' &&
          result.reason instanceof ConflictException,
      );

      expect(successfulCreates).toHaveLength(1);
      expect(failedCreates).toHaveLength(2);
      expect(reservedQuantity).toBe(6);
      expect(committedTransports).toHaveLength(1);
      expect(stockReservationsService.createReservation).toHaveBeenCalledTimes(
        3,
      );
    });

    it('fails transport creation when stock reservation creation fails', async () => {
      const stockConflict = new Error('stock reservation conflict');
      const tx = {
        transport: {
          create: jest.fn().mockResolvedValue({
            id: 'transport-1',
            internalCode: 'TRP-000001',
            status: TransportStatus.PENDING,
            vehicle: { licensePlate: 'AA-00-AA' },
            company: { id: 'company-1' },
          }),
        },
      };

      (prismaService.vehicle.findFirst as jest.Mock).mockResolvedValue({
        id: 'vehicle-1',
        capacity: 1000,
        status: 'available',
        licensePlate: 'AA-00-AA',
        model: 'Van',
      });
      (prismaService.transport.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prismaService.product.findFirst as jest.Mock).mockResolvedValue({
        id: 'product-1',
        quantity: 10,
        internalCode: 'SKU-1',
      });
      stockReservationsService.createReservation.mockRejectedValue(
        stockConflict,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => callback(tx),
      );

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            origin: 'Lisboa',
            destination: 'Porto',
            departureDate: '2026-09-15',
            estimatedArrival: '2026-09-16',
            totalWeight: 100,
            products: [{ productId: 'product-1', quantity: 4 }],
          } as any,
          'company-1',
          'user-1',
        ),
      ).rejects.toBe(stockConflict);

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('creates a reservation inside transport creation', async () => {
      const tx = {
        transport: {
          create: jest.fn().mockResolvedValue({
            id: 'transport-1',
            internalCode: 'TRP-000001',
            status: TransportStatus.PENDING,
            vehicle: { licensePlate: 'AA-00-AA' },
            company: { id: 'company-1' },
          }),
        },
        transportProduct: { create: jest.fn() },
        product: {
          update: jest
            .fn()
            .mockResolvedValue({ status: 'DISPATCHED', quantity: 10 }),
        },
        productMovement: { create: jest.fn() },
        vehicle: { update: jest.fn() },
      };

      (prismaService.vehicle.findFirst as jest.Mock).mockResolvedValue({
        id: 'vehicle-1',
        capacity: 1000,
        status: 'available',
        licensePlate: 'AA-00-AA',
        model: 'Van',
      });
      (prismaService.transport.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prismaService.product.findFirst as jest.Mock).mockResolvedValue({
        id: 'product-1',
        quantity: 10,
        internalCode: 'SKU-1',
      });
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => callback(tx),
      );

      await service.create(
        {
          vehicleId: 'vehicle-1',
          origin: 'Lisboa',
          destination: 'Porto',
          departureDate: '2026-09-15',
          estimatedArrival: '2026-09-16',
          totalWeight: 100,
          products: [{ productId: 'product-1', quantity: 4 }],
        } as any,
        'company-1',
        'user-1',
      );

      expect(stockReservationsService.createReservation).toHaveBeenCalledWith(
        'company-1',
        'product-1',
        4,
        'transport-1',
        tx,
      );
      expect(appGateway.emitToCompany).toHaveBeenCalledWith(
        'company-1',
        'transport:created',
        expect.objectContaining({
          companyId: 'company-1',
          transportId: 'transport-1',
          status: TransportStatus.PENDING,
          timestamp: expect.any(String),
        }),
      );
    });

    it('emits reservation:created exactly once after transport transaction commit', async () => {
      const reservation = {
        id: 'reservation-1',
        companyId: 'company-1',
        productId: 'product-1',
        quantity: 4,
        status: 'RESERVED',
        transportId: 'transport-1',
      };
      const tx = {
        transport: {
          create: jest.fn().mockResolvedValue({
            id: 'transport-1',
            internalCode: 'TRP-000001',
            status: TransportStatus.PENDING,
            vehicle: { licensePlate: 'AA-00-AA' },
            company: { id: 'company-1' },
          }),
        },
        transportProduct: { create: jest.fn() },
        product: {
          update: jest
            .fn()
            .mockResolvedValue({ status: 'DISPATCHED', quantity: 10 }),
        },
        productMovement: { create: jest.fn() },
        vehicle: { update: jest.fn() },
      };

      (prismaService.vehicle.findFirst as jest.Mock).mockResolvedValue({
        id: 'vehicle-1',
        capacity: 1000,
        status: 'available',
        licensePlate: 'AA-00-AA',
        model: 'Van',
      });
      (prismaService.transport.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prismaService.product.findFirst as jest.Mock).mockResolvedValue({
        id: 'product-1',
        quantity: 10,
        internalCode: 'SKU-1',
      });
      (prismaService.stockReservation.findMany as jest.Mock).mockResolvedValue([
        reservation,
      ]);
      stockReservationsService.emitReservationEvent.mockImplementation(
        async (event, persistedReservation, companyId) => {
          appGateway.emitToCompany(companyId, event, {
            companyId,
            reservationId: persistedReservation.id,
            productId: persistedReservation.productId,
            quantity: persistedReservation.quantity,
            status: persistedReservation.status,
            transportId: persistedReservation.transportId,
            timestamp: new Date().toISOString(),
          });
        },
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => callback(tx),
      );

      await service.create(
        {
          vehicleId: 'vehicle-1',
          origin: 'Lisboa',
          destination: 'Porto',
          departureDate: '2026-09-15',
          estimatedArrival: '2026-09-16',
          totalWeight: 100,
          products: [{ productId: 'product-1', quantity: 4 }],
        } as any,
        'company-1',
        'user-1',
      );

      const reservationCreatedEvents =
        appGateway.emitToCompany.mock.calls.filter(
          ([companyId, event]) =>
            companyId === 'company-1' && event === 'stock:reservation-created',
        );

      expect(reservationCreatedEvents).toHaveLength(1);
      expect(stockReservationsService.createReservation).toHaveBeenCalledWith(
        'company-1',
        'product-1',
        4,
        'transport-1',
        tx,
      );
      expect(reservationCreatedEvents[0][2]).toEqual(
        expect.objectContaining({
          reservationId: 'reservation-1',
          productId: 'product-1',
          status: 'RESERVED',
        }),
      );
    });

    it('confirms reservations when a transport enters IN_TRANSIT', async () => {
      const transport = {
        id: 'transport-1',
        companyId: 'company-1',
        status: TransportStatus.PENDING,
        vehicleId: 'vehicle-1',
        products: [],
      };
      const updatedTransport = {
        ...transport,
        status: TransportStatus.IN_TRANSIT,
      };
      const tx = {
        transport: { update: jest.fn().mockResolvedValue(updatedTransport) },
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(transport as any);
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => callback(tx),
      );

      await service.updateStatus(
        'transport-1',
        TransportStatus.IN_TRANSIT,
        'company-1',
        'user-1',
      );

      expect(
        stockReservationsService.confirmReservationsForTransport,
      ).toHaveBeenCalledWith('transport-1', 'company-1', tx);
      expect(appGateway.emitToCompany).toHaveBeenCalledWith(
        'company-1',
        'transport:updated',
        expect.objectContaining({
          transportId: 'transport-1',
          previousStatus: TransportStatus.PENDING,
          status: TransportStatus.IN_TRANSIT,
        }),
      );
    });

    it('releases reservations when a transport is canceled', async () => {
      const transport = {
        id: 'transport-1',
        companyId: 'company-1',
        status: TransportStatus.PENDING,
        vehicleId: 'vehicle-1',
        products: [],
      };
      const updatedTransport = {
        ...transport,
        status: TransportStatus.CANCELED,
      };
      const tx = {
        transport: {
          update: jest.fn().mockResolvedValue({
            ...updatedTransport,
            vehicle: { licensePlate: 'AA-00-AA' },
          }),
        },
        product: { update: jest.fn() },
        productMovement: { create: jest.fn() },
        vehicle: { update: jest.fn() },
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(transport as any);
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => callback(tx),
      );

      await service.updateStatus(
        'transport-1',
        TransportStatus.CANCELED,
        'company-1',
        'user-1',
      );

      expect(
        stockReservationsService.releaseReservationsForTransport,
      ).toHaveBeenCalledWith('transport-1', 'company-1', tx);
      expect(appGateway.emitToCompany).toHaveBeenCalledWith(
        'company-1',
        'transport:updated',
        expect.objectContaining({
          transportId: 'transport-1',
          previousStatus: TransportStatus.PENDING,
          status: TransportStatus.CANCELED,
        }),
      );
    });

    it('does not change reservations when a transport is delivered', async () => {
      const transport = {
        id: 'transport-1',
        companyId: 'company-1',
        status: TransportStatus.ARRIVED,
        vehicleId: 'vehicle-1',
        destination: 'Porto',
        products: [],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(transport as any);
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) =>
          callback({
            transport: {
              update: jest.fn().mockResolvedValue({
                ...transport,
                status: TransportStatus.DELIVERED,
                vehicle: {},
                company: {},
                products: [],
              }),
            },
            vehicle: { update: jest.fn() },
          }),
      );

      await service.updateStatus(
        'transport-1',
        TransportStatus.DELIVERED,
        'company-1',
        'user-1',
      );

      expect(
        stockReservationsService.confirmReservationsForTransport,
      ).not.toHaveBeenCalled();
      expect(
        stockReservationsService.releaseReservationsForTransport,
      ).not.toHaveBeenCalled();
    });
  });
});
