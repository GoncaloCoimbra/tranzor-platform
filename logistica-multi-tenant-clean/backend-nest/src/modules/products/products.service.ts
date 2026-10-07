import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { ListProductsDto } from './dto/list-products.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    companyId: string,
    userId: string,
  ) {
    // Validate se o supplier existe
    if (!createProductDto.supplierId) {
      throw new BadRequestException('Supplier is required');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: createProductDto.supplierId,
        companyId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    //  Define status padrão se não fornecido
    const status = createProductDto.status || 'RECEIVED';

    const product = await this.prisma.product.create({
      data: {
        internalCode: createProductDto.internalCode,
        description: createProductDto.description,
        quantity: createProductDto.quantity,
        unit: createProductDto.unit,
        totalWeight: createProductDto.totalWeight,
        totalVolume: createProductDto.totalVolume,
        currentLocation: createProductDto.currentLocation,
        status: status, //  Usa o status do DTO ou RECEIVED
        supplierId: createProductDto.supplierId,
        companyId,
      },
      include: {
        supplier: true,
      },
    });

    // Create movimento inicial
    await this.prisma.productMovement.create({
      data: {
        productId: product.id,
        companyId,
        previousStatus: status,
        newStatus: status,
        quantity: product.quantity,
        location: product.currentLocation || 'Entrada',
        reason: 'Initial product receipt',
        userId,
      },
    });

    // 🔔 Dispara notificação automática
    try {
      this.logger.log(
        `🔔 [NOTIF-1] Starting notification: userId=${userId}, companyId=${companyId}`,
      );

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, companyId: true, id: true },
      });

      if (!user) {
        this.logger.error(
          `❌ [NOTIF-2] User not found para notificação: ${userId}`,
        );
        throw new Error(`User not found: ${userId}`);
      }

      this.logger.log(
        `✅ [NOTIF-2] User found: ${user.id}, userCompanyId=${user.companyId}, requestCompanyId=${companyId}`,
      );

      if (user.companyId !== companyId) {
        this.logger.error(
          `❌ [NOTIF-3] CompanyId mismatch: ${user.companyId} !== ${companyId}`,
        );
        throw new Error(`Company mismatch`);
      }

      this.logger.log(`🔔 [NOTIF-3] Calling notificationsService.create()`);
      const result = await this.notificationsService.create({
        title: '📦 New Product Registered',
        message: `New product "${product.description}" (${product.internalCode}) was registered by ${user?.name || 'Utilizador'}`,
        userId,
        companyId,
      });
      this.logger.log(`✅ [NOTIF-4] Notification created: ${result?.id}`);
    } catch (error: any) {
      this.logger.error(`❌ [NOTIF-ERROR] ${error?.message}`);
      this.logger.error('Stack:', error?.stack);
    }

    //  O AUDIT LOG É CRIADO AUTOMATICAMENTE PELO INTERCEPTOR
    console.log('🔍 [SERVICE] Product created, returning:', product);
    return product;
  }

  async findAll(companyId: string, filters: ListProductsDto = new ListProductsDto()) {
    const where: any = {
      companyId, // Add companyId filter to restrict to current company
    };

    // Filtro por ID do supplier
    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    // Filtro por NOME do supplier (busca parcial)
    if (filters?.supplier) {
      where.supplier = {
        name: { contains: filters.supplier, mode: 'insensitive' },
      };
    }

    // Filtro por status
    if (filters?.status) {
      where.status = filters.status;
    }

    // Filtro por localização
    if (filters?.location) {
      where.currentLocation = {
        contains: filters.location,
        mode: 'insensitive',
      };
    }

    // Filtro por date de criação
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Filtro por busca (código interno OU descrição)
    if (filters?.search) {
      where.OR = [
        { internalCode: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;
    const orderBy = { [filters.sortBy]: filters.order };
    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: filters.limit,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              nif: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  }

  async findOne(id: string, companyId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: {
        supplier: true,
      },
    });

    if (!product) {
      throw new NotFoundException('product not found');
    }

    return product;
  }

  async getStockBySku(sku: string, companyId: string) {
    const product = await this.prisma.product.findFirst({
      where: { internalCode: sku, companyId },
      select: {
        id: true,
        internalCode: true,
        description: true,
        quantity: true,
        status: true,
        companyId: true,
        updatedAt: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      sku: product.internalCode,
      description: product.description,
      stock: product.quantity,
      status: product.status,
      companyId: product.companyId,
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  async getLowStock(companyId: string) {
    const threshold = 5;
    const where = { companyId, quantity: { lte: threshold } };
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          internalCode: true,
          description: true,
          quantity: true,
          unit: true,
        },
        orderBy: [{ quantity: 'asc' }, { internalCode: 'asc' }],
        take: 50,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { threshold, total, products };
  }

  async getStatsByStatus(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId },
      select: { status: true },
    });

    const stats = products.reduce(
      (acc, product) => {
        acc[product.status] = (acc[product.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: products.length,
      byStatus: stats,
    };
  }

  async findWithMovements(id: string, companyId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: {
        supplier: true,
        movements: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('product not found');
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    companyId: string,
    userId: string,
  ) {
    const product = await this.findOne(id, companyId);

    if (
      updateProductDto.supplierId &&
      updateProductDto.supplierId !== product.supplierId
    ) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          id: updateProductDto.supplierId,
          companyId,
        },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
    }

    return this.prisma.product.update({
      where: { id: product.id },
      data: updateProductDto,
      include: {
        supplier: true,
      },
    });
  }

  async updateStatus(
    id: string,
    statusDto: UpdateProductStatusDto,
    companyId: string,
    userId: string,
  ) {
    const product = await this.findOne(id, companyId);

    const updatedProduct = await this.prisma.product.update({
      where: { id: product.id },
      data: {
        status: statusDto.newStatus,
        currentLocation: statusDto.location || product.currentLocation,
      },
      include: {
        supplier: true,
      },
    });

    await this.prisma.productMovement.create({
      data: {
        productId: product.id,
        companyId,
        previousStatus: product.status,
        newStatus: statusDto.newStatus,
        quantity: statusDto.quantity || product.quantity,
        location: statusDto.location || product.currentLocation || 'N/A',
        reason:
          statusDto.reason || `Alteração de estado para ${statusDto.newStatus}`,
        userId,
      },
    });

    // Dispara notificação automática de alteração de status
    // Falha silenciosa intencional: notificação é best-effort, não bloqueia a transação
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      const statusLabel: Record<string, string> = {
        RECEIVED: 'Received',
        IN_ANALYSIS: 'Under Analysis',
        IN_STORAGE: 'In Storage',
        APPROVED: 'Approved',
        DISPATCHED: 'Dispatched',
      };

      await this.notificationsService.create({
        title: `Product Updated`,
        message: `product "${product.description}" (${product.internalCode}) foi alterado de ${statusLabel[product.status] || product.status} para ${statusLabel[statusDto.newStatus] || statusDto.newStatus} por ${user?.name || 'Utilizador'}`,
        userId,
        companyId,
      });
      this.logger.log(
        `✅ Notificação enviada para atualização de status: ${product.id}`,
      );
    } catch (error) {
      // Log apenas, não propaga: notificação falhada não deve falhar a operação
      this.logger.warn(
        `⚠️ Notificação de status não enviada para produto ${product.id}: ${error?.message}`,
        'ProductsService',
      );
    }

    return updatedProduct;
  }

  //  MÉTODO REMOVE COM VALIDAÇÃO DE STATUS
  async remove(id: string, companyId: string, userId: string) {
    const productRecord = await this.prisma.product.findUnique({ where: { id } });
    if (!productRecord) {
      throw new NotFoundException('product not found');
    }
    if (productRecord.companyId !== companyId) {
      throw new ForbiddenException('Cannot delete a product from another company');
    }
    const product = await this.findOne(id, companyId);

    // Validation: Só permite excluir products no estado RECEIVED
    if (product.status !== 'RECEIVED') {
      throw new BadRequestException(
        `Não é possível excluir este product. Apenas products no estado "RECEBIDO" podem ser eliminados. Estado atual: ${product.status}`,
      );
    }

    // Remove os movimentos relacionados
    await this.prisma.productMovement.deleteMany({
      where: { productId: product.id },
    });

    // Remove o product
    return this.prisma.product.delete({
      where: { id: product.id },
    });
  }
}
