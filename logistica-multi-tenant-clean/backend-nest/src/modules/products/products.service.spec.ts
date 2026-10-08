import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductStatus } from '@prisma/client';
import { ListProductsDto } from './dto/list-products.dto';

describe('ProductsService - State Machine Tests', () => {
  let service: ProductsService;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const mockCompanyId = 'company-123';
  const mockUserId = 'user-123';
  const mockProductId = 'product-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            productMovement: {
              create: jest.fn(),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ name: 'Test User' }),
            },
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    // Clear all mocks to prevent cross-test contamination
    jest.clearAllMocks();
  });

  describe('Product Status Transitions', () => {
    const validTransitions: Record<ProductStatus, ProductStatus[]> = {
      RECEIVED: [ProductStatus.IN_ANALYSIS, ProductStatus.IN_STORAGE],
      IN_ANALYSIS: [ProductStatus.IN_STORAGE, ProductStatus.APPROVED],
      IN_STORAGE: [ProductStatus.APPROVED, ProductStatus.DISPATCHED],
      APPROVED: [ProductStatus.DISPATCHED],
      DISPATCHED: [], // Final state
    };

    Object.entries(validTransitions).forEach(([fromStatus, toStatuses]) => {
      describe(`From ${fromStatus}`, () => {
        toStatuses.forEach((toStatus) => {
          it(`should allow transition to ${toStatus}`, async () => {
            const mockProduct = {
              id: mockProductId,
              status: fromStatus as ProductStatus,
              currentLocation: 'Location A',
              quantity: 10,
              description: 'Test Product',
              internalCode: 'TEST-001',
              supplier: { id: 'supplier-123', name: 'Test Supplier' },
            };

            const mockUpdatedProduct = {
              ...mockProduct,
              status: toStatus,
            };

            (prisma.product.findFirst as jest.Mock).mockResolvedValue(
              mockProduct,
            );
            (prisma.product.update as jest.Mock).mockResolvedValue(
              mockUpdatedProduct,
            );
            (prisma.productMovement.create as jest.Mock).mockResolvedValue({});
            (notificationsService.create as jest.Mock).mockResolvedValue({});

            const result = await service.updateStatus(
              mockProductId,
              { newStatus: toStatus },
              mockCompanyId,
              mockUserId,
            );

            expect(result.status).toBe(toStatus);
            expect(prisma.productMovement.create).toHaveBeenCalledWith({
              data: {
                productId: mockProductId,
                companyId: mockCompanyId,
                previousStatus: fromStatus as ProductStatus,
                newStatus: toStatus,
                quantity: mockProduct.quantity,
                location: mockProduct.currentLocation,
                reason: `Alteração de estado para ${toStatus}`,
                userId: mockUserId,
              },
            });
            // Verify notification was triggered on status change
            expect(notificationsService.create).toHaveBeenCalled();
          });
        });

        // Test invalid transitions
        const allStatuses = Object.values(ProductStatus);
        const invalidTransitions = allStatuses.filter(
          (status) => !toStatuses.includes(status),
        );

        invalidTransitions.forEach((invalidStatus) => {
          it(`should allow transition to ${invalidStatus} (no business rule validation)`, async () => {
            // Note: Current implementation doesn't validate transitions
            // This test documents current behavior
            const mockProduct = {
              id: mockProductId,
              status: fromStatus as ProductStatus,
              currentLocation: 'Location A',
              quantity: 10,
              description: 'Test Product',
              internalCode: 'TEST-001',
              supplier: { id: 'supplier-123', name: 'Test Supplier' },
            };

            const mockUpdatedProduct = {
              ...mockProduct,
              status: invalidStatus,
            };

            (prisma.product.findFirst as jest.Mock).mockResolvedValue(
              mockProduct,
            );
            (prisma.product.update as jest.Mock).mockResolvedValue(
              mockUpdatedProduct,
            );
            (prisma.productMovement.create as jest.Mock).mockResolvedValue({});
            (notificationsService.create as jest.Mock).mockResolvedValue({});

            const result = await service.updateStatus(
              mockProductId,
              { newStatus: invalidStatus },
              mockCompanyId,
              mockUserId,
            );

            expect(result.status).toBe(invalidStatus);
          });
        });
      });
    });
  });

  it('returns paginated products with tenant filters and ordering', async () => {
    const query: ListProductsDto = {
      page: 2,
      limit: 10,
      status: ProductStatus.IN_STORAGE,
      sortBy: 'internalCode',
      order: 'asc',
    };
    const products = [{ id: mockProductId }];

    (prisma.product.findMany as jest.Mock).mockResolvedValue(products);
    (prisma.product.count as jest.Mock).mockResolvedValue(11);

    await expect(service.findAll(mockCompanyId, query)).resolves.toEqual({
      data: products,
      total: 11,
      page: 2,
      limit: 10,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: mockCompanyId, status: ProductStatus.IN_STORAGE },
        skip: 10,
        take: 10,
        orderBy: { internalCode: 'asc' },
      }),
    );
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { companyId: mockCompanyId, status: ProductStatus.IN_STORAGE },
    });
  });

  it('lists only tenant products at or below the low-stock threshold', async () => {
    const products = [
      {
        internalCode: 'SKU-1',
        description: 'Low quantity',
        quantity: 2,
        unit: 'pcs',
      },
    ];
    (prisma.product.findMany as jest.Mock).mockResolvedValue(products);
    (prisma.product.count as jest.Mock).mockResolvedValue(1);

    await expect(service.getLowStock(mockCompanyId)).resolves.toEqual({
      threshold: 5,
      total: 1,
      products,
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { companyId: mockCompanyId, quantity: { lte: 5 } },
      select: {
        internalCode: true,
        description: true,
        quantity: true,
        unit: true,
      },
      orderBy: [{ quantity: 'asc' }, { internalCode: 'asc' }],
      take: 50,
    });
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: { companyId: mockCompanyId, quantity: { lte: 5 } },
    });
  });

  describe('Edge Cases', () => {
    it('should handle transition with location change', async () => {
      const mockProduct = {
        id: mockProductId,
        status: ProductStatus.RECEIVED,
        currentLocation: 'Location A',
        quantity: 10,
        description: 'Test Product',
        internalCode: 'TEST-001',
        supplier: { id: 'supplier-123', name: 'Test Supplier' },
      };

      const newLocation = 'Location B';
      const mockUpdatedProduct = {
        ...mockProduct,
        status: ProductStatus.IN_STORAGE,
        currentLocation: newLocation,
      };

      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValue(
        mockUpdatedProduct,
      );
      (prisma.productMovement.create as jest.Mock).mockResolvedValue({});
      (notificationsService.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateStatus(
        mockProductId,
        {
          newStatus: ProductStatus.IN_STORAGE,
          location: newLocation,
          reason: 'Moving to storage',
        },
        mockCompanyId,
        mockUserId,
      );

      expect(result.status).toBe(ProductStatus.IN_STORAGE);
      expect(result.currentLocation).toBe(newLocation);
      expect(prisma.productMovement.create).toHaveBeenCalledWith({
        data: {
          productId: mockProductId,
          companyId: mockCompanyId,
          previousStatus: ProductStatus.RECEIVED,
          newStatus: ProductStatus.IN_STORAGE,
          quantity: mockProduct.quantity,
          location: newLocation,
          reason: 'Moving to storage',
          userId: mockUserId,
        },
      });
    });

    it('should handle transition with quantity change', async () => {
      const mockProduct = {
        id: mockProductId,
        status: ProductStatus.IN_STORAGE,
        currentLocation: 'Location A',
        quantity: 10,
        description: 'Test Product',
        internalCode: 'TEST-001',
        supplier: { id: 'supplier-123', name: 'Test Supplier' },
      };

      const newQuantity = 8;
      const mockUpdatedProduct = {
        ...mockProduct,
        status: ProductStatus.DISPATCHED,
      };

      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValue(
        mockUpdatedProduct,
      );
      (prisma.productMovement.create as jest.Mock).mockResolvedValue({});
      (notificationsService.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateStatus(
        mockProductId,
        {
          newStatus: ProductStatus.DISPATCHED,
          quantity: newQuantity,
          reason: 'Partial dispatch',
        },
        mockCompanyId,
        mockUserId,
      );

      expect(result.status).toBe(ProductStatus.DISPATCHED);
      expect(prisma.productMovement.create).toHaveBeenCalledWith({
        data: {
          productId: mockProductId,
          companyId: mockCompanyId,
          previousStatus: ProductStatus.IN_STORAGE,
          newStatus: ProductStatus.DISPATCHED,
          quantity: newQuantity,
          location: mockProduct.currentLocation,
          reason: 'Partial dispatch',
          userId: mockUserId,
        },
      });
    });
  });
});
