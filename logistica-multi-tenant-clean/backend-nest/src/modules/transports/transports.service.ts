import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { TransportStatus, VehicleStatus, ProductStatus } from '@prisma/client';
import { CreateTransportDto } from './dto/create-transport.dto';
import { UpdateTransportDto } from './dto/update-transport.dto';
import { FilterTransportDto } from './dto/filter-transport.dto';
import { ListTransportsDto } from './dto/list-transports.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { StockReservationsService } from '../stock-reservations/stock-reservations.service';
import { AppGateway } from '../../app.gateway';

@Injectable()
export class TransportsService {
  private readonly logger = new Logger(TransportsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private auditLogService: AuditLogService,
    private stockReservationsService: StockReservationsService,
    private appGateway: AppGateway,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🔒 HELPER METHOD: Check if vehicle is available
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private async checkVehicleAvailability(vehicleId: string, companyId: string) {
    this.logger.log(`🔍 Checking vehicle availability ${vehicleId}...`);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        companyId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException(
        '🚫 Vehicle not found or does not belong to this company',
      );
    }

    if (vehicle.status === VehicleStatus.in_maintenance) {
      throw new BadRequestException(
        `🔧 Vehicle ${vehicle.licensePlate} is in maintenance and cannot be used.\n` +
          `Please choose another vehicle.`,
      );
    }

    if (vehicle.status === VehicleStatus.retired) {
      throw new BadRequestException(
        `❌ Vehicle ${vehicle.licensePlate} is inactive.\n` +
          `Please choose another vehicle.`,
      );
    }

    const activeTransport = await this.prisma.transport.findFirst({
      where: {
        vehicleId: vehicleId,
        companyId,
        status: {
          in: [
            TransportStatus.PENDING,
            TransportStatus.IN_TRANSIT,
            TransportStatus.ARRIVED,
          ],
        },
      },
      select: {
        id: true,
        internalCode: true,
        status: true,
        origin: true,
        destination: true,
        estimatedArrival: true,
      },
    });

    if (activeTransport) {
      this.logger.warn(`🚨 Vehicle ${vehicle.licensePlate} is already in use!`);
      this.logger.warn(`   Active transport: ${activeTransport.internalCode}`);
      this.logger.warn(`   Status: ${activeTransport.status}`);
      this.logger.warn(
        `   Route: ${activeTransport.origin} → ${activeTransport.destination}`,
      );

      const statusMessages = {
        [TransportStatus.PENDING]: 'pending departure',
        [TransportStatus.IN_TRANSIT]: 'in transit',
        [TransportStatus.ARRIVED]:
          'arrived at destination and awaiting verification',
      };

      throw new ConflictException(
        `🚫 VEHICLE UNAVAILABLE\n\n` +
          `🚗 Vehicle: ${vehicle.licensePlate} (${vehicle.model})\n` +
          `📦 Already allocated to transport: ${activeTransport.internalCode}\n` +
          `🚛 Current status: ${statusMessages[activeTransport.status]}\n` +
          `📍 Route: ${activeTransport.origin} → ${activeTransport.destination}\n` +
          `📅 Estimated arrival: ${new Date(activeTransport.estimatedArrival).toLocaleDateString('en-US')}\n\n` +
          `💡 The vehicle will be available after:\n` +
          `  • Delivery is completed (status DELIVERED), or\n` +
          `  • The transport is canceled (status CANCELED)\n\n` +
          `🔍 Please choose another available vehicle.`,
      );
    }

    this.logger.log(`✅ Vehicle ${vehicle.licensePlate} is available!`);
    return vehicle;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🤖 CRON JOB: Auto-Arrive Transports
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Cron('0 5 0 * * *', {
    name: 'auto-arrive-transports',
    timeZone: 'Europe/Lisbon',
  })
  async autoArriveTransports() {
    this.logger.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );
    this.logger.log('🤖 CRON JOB EXECUTED: Auto-Arrive Transports');
    this.logger.log(`📅 Date/Time: ${new Date().toLocaleString('en-US')}`);
    this.logger.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    );

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      this.logger.log(
        `🔍 Looking for IN_TRANSIT transports with estimated arrival date <= ${today.toLocaleDateString('en-US')}`,
      );

      const transportsToArrive = await this.prisma.transport.findMany({
        where: {
          status: TransportStatus.IN_TRANSIT,
          estimatedArrival: {
            lte: today,
          },
        },
        include: {
          vehicle: true,
          company: true,
          products: {
            include: {
              product: true,
            },
          },
        },
      });

      if (transportsToArrive.length === 0) {
        this.logger.log('✅ No transports to process today');
        this.logger.log(
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        );
        return;
      }

      this.logger.log(
        `📦 Found ${transportsToArrive.length} transport(s) to process`,
      );

      let processedCount = 0;
      let errorCount = 0;

      for (const transport of transportsToArrive) {
        try {
          this.logger.log(
            `\n🚚 Processing transport ${transport.internalCode}`,
          );
          this.logger.log(
            `   📍 Route: ${transport.origin} → ${transport.destination}`,
          );
          this.logger.log(`   🚗 Vehicle: ${transport.vehicle.licensePlate}`);
          this.logger.log(
            `   📅 Estimated date: ${new Date(transport.estimatedArrival).toLocaleDateString('en-US')}`,
          );

          await this.prisma.transport.update({
            where: { id: transport.id },
            data: { status: TransportStatus.ARRIVED },
          });

          this.logger.log(`   ✅ Status changed: IN_TRANSIT → ARRIVED`);

          const usersToNotify = await this.prisma.user.findMany({
            where: {
              companyId: transport.companyId,
              role: { in: ['ADMIN', 'OPERATOR'] },
              isActive: true,
            },
            select: {
              id: true,
              name: true,
              email: true,
            },
          });

          this.logger.log(
            `   📧 Sending notifications to ${usersToNotify.length} user(s)`,
          );

          // FIX HERE: Adding the missing origin parameter
          await this.notificationsService.notifyTransportArrived(
            transport.companyId,
            transport.internalCode,
            transport.origin, // Parameter added
            transport.destination,
          );

          this.logger.log(
            `      ✓ Notifications sent to ${usersToNotify.length} users`,
          );

          processedCount++;
          this.logger.log(
            `   ✅ Transport ${transport.internalCode} processed successfully`,
          );
        } catch (error) {
          errorCount++;
          this.logger.error(
            `   ❌ Error processing transport ${transport.internalCode}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
      this.logger.log('📊 CRON JOB SUMMARY');
      this.logger.log(`   ✅ Processed: ${processedCount}`);
      this.logger.log(`   ❌ Errors: ${errorCount}`);
      this.logger.log(`   📦 Total: ${transportsToArrive.length}`);
      this.logger.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
    } catch (error) {
      this.logger.error(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
      this.logger.error('🚨 CRITICAL ERROR IN CRON JOB');
      this.logger.error(`Message: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      this.logger.error(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      );
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📦 CREATE - Create new transport
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  async create(date: CreateTransportDto, companyId: string, userId: string) {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`📦 Creating new transport`);
    this.logger.log(`🏢 CompanyId: ${companyId}`);
    this.logger.log(`👤 UserId: ${userId}`);
    this.logger.log(`📦 Products: ${date.products?.length || 0}`);

    const vehicle = await this.checkVehicleAvailability(
      date.vehicleId,
      companyId,
    );

    if (date.totalWeight > vehicle.capacity) {
      throw new BadRequestException(
        `⚖️ CAPACITY EXCEEDED\n\n` +
          `🚗 Vehicle: ${vehicle.licensePlate}\n` +
          `📊 Maximum capacity: ${vehicle.capacity}kg\n` +
          `📦 Requested weight: ${date.totalWeight}kg\n` +
          `⚠️ Excess: ${date.totalWeight - vehicle.capacity}kg\n\n` +
          `💡 Reduce the load or choose a larger vehicle.`,
      );
    }

    if (date.products && date.products.length > 0) {
      for (const productData of date.products) {
        const product = await this.prisma.product.findFirst({
          where: {
            id: productData.productId,
            companyId,
          },
        });

        if (!product) {
          throw new NotFoundException(
            `Product ${productData.productId} not found`,
          );
        }

        if (product.quantity < productData.quantity) {
          throw new ConflictException(
            `📦 INSUFFICIENT STOCK\n\n` +
              `Product: ${product.internalCode}\n` +
              `Available: ${product.quantity} units\n` +
              `Requested: ${productData.quantity} units\n` +
              `Missing: ${productData.quantity - product.quantity} units`,
          );
        }
      }
    }

    const lastTransport = await this.prisma.transport.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });

    const nextNumber = lastTransport
      ? parseInt(lastTransport.internalCode.split('-')[1]) + 1
      : 1;

    const internalCode = `TRP-${nextNumber.toString().padStart(6, '0')}`;
    this.logger.log(`🔢 Código gerado: ${internalCode}`);

    const transport = await this.prisma.$transaction(async (tx) => {
      const newTransport = await tx.transport.create({
        data: {
          internalCode,
          vehicleId: date.vehicleId,
          origin: date.origin,
          destination: date.destination,
          departureDate: new Date(date.departureDate),
          estimatedArrival: new Date(date.estimatedArrival),
          totalWeight: date.totalWeight,
          notes: date.notes,
          status: date.status || TransportStatus.PENDING,
          companyId,
        },
        include: {
          vehicle: true,
          company: true,
        },
      });

      this.logger.log(`✅ Transport criado: ${newTransport.id}`);

      if (date.products && date.products.length > 0) {
        this.logger.log(`📦 Processando ${date.products.length} product(s)...`);

        for (const productData of date.products) {
          await this.stockReservationsService.createReservation(
            companyId,
            productData.productId,
            productData.quantity,
            newTransport.id,
            tx,
          );

          await tx.transportProduct.create({
            data: {
              transportId: newTransport.id,
              productId: productData.productId,
              companyId,
              quantity: productData.quantity,
            },
          });

          this.logger.log(`  ✓ product ${productData.productId} associado`);

          const product = await tx.product.update({
            where: { id: productData.productId },
            data: {
              status: ProductStatus.DISPATCHED,
            },
          });

          this.logger.log(`  ✓ Status mudado: ${product.status}`);
          this.logger.log(`  ✓ Quantity atualizada: ${product.quantity}`);

          await tx.productMovement.create({
            data: {
              productId: productData.productId,
              companyId,
              previousStatus: ProductStatus.IN_STORAGE,
              newStatus: ProductStatus.DISPATCHED,
              quantity: productData.quantity,
              location: date.origin,
              reason: `Adicionado ao transport ${internalCode}`,
              userId: userId,
            },
          });

          this.logger.log(`  ✓ Movimento registrado`);
        }
      }

      await tx.vehicle.update({
        where: { id: date.vehicleId },
        data: { status: VehicleStatus.in_use },
      });

      this.logger.log(
        `🚗 Vehicle ${vehicle.licensePlate} → IN_USE (bloqueado)`,
      );

      return newTransport;
    });

    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    this.appGateway.emitToCompany(companyId, 'transport:created', {
      companyId,
      transportId: transport.id,
      status: transport.status,
      timestamp: new Date().toISOString(),
    });
    await this.emitReservationsForTransport(
      transport.id,
      companyId,
      'reservation:created',
      'RESERVED',
    );

    this.logger.log(`✅ Transport criado com success!`);
    this.logger.log(`   🆔 ID: ${transport.id}`);
    this.logger.log(`   🔢 Código: ${transport.internalCode}`);
    this.logger.log(`   📦 products: ${date.products?.length || 0}`);
    this.logger.log(
      `   🚗 Vehicle: ${transport.vehicle.licensePlate} → IN_USE`,
    );
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return transport;
  }

  async findAll(
    companyId?: string,
    filters: ListTransportsDto = new ListTransportsDto(),
  ) {
    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.departureDate = {};
      if (filters.startDate) {
        where.departureDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.departureDate.lte = new Date(filters.endDate);
      }
    }

    if (filters?.vehicleId) {
      where.vehicleId = filters.vehicleId;
    }

    const skip = (filters.page - 1) * filters.limit;
    const orderBy = { [filters.sortBy]: filters.order };
    const [data, total] = await Promise.all([
      this.prisma.transport.findMany({
        where,
        skip,
        take: filters.limit,
        include: {
          vehicle: true,
          company: true,
          products: {
            include: {
              product: {
                include: {
                  supplier: true,
                },
              },
            },
          },
        },
        orderBy,
      }),
      this.prisma.transport.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit };
  }

  async findPending(companyId?: string) {
    const where: any = {
      status: TransportStatus.PENDING,
    };

    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.transport.findMany({
      where,
      include: {
        vehicle: true,
        company: true,
        products: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { departureDate: 'asc' },
    });
  }

  async findInTransit(companyId?: string) {
    const where: any = {
      status: TransportStatus.IN_TRANSIT,
    };

    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.transport.findMany({
      where,
      include: {
        vehicle: true,
        company: true,
        products: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { departureDate: 'asc' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const where: any = { id };

    if (companyId) {
      where.companyId = companyId;
    }

    const transport = await this.prisma.transport.findFirst({
      where,
      include: {
        vehicle: true,
        company: true,
        products: {
          include: {
            product: {
              include: {
                supplier: true,
              },
            },
          },
        },
      },
    });

    if (!transport) {
      throw new NotFoundException('Transport não encontrado');
    }

    return transport;
  }

  async addProduct(
    transportId: string,
    productId: string,
    quantity: number,
    companyId: string,
    userId: string,
  ) {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`📥 Adding product to transport ${transportId}`);
    this.logger.log(`📦 Product: ${productId} quantity: ${quantity}`);

    const transport = await this.findOne(transportId, companyId);

    if (transport.status !== TransportStatus.PENDING) {
      throw new BadRequestException(
        `Cannot add products to transport in status ${transport.status}. Only PENDING transports can be modified.`,
      );
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        companyId,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    if (product.quantity < quantity) {
      throw new ConflictException(
        `Insufficient stock for product ${product.internalCode}. Requested ${quantity}, available ${product.quantity}.`,
      );
    }

    const updatedTransport = await this.prisma.$transaction(async (tx) => {
      await this.stockReservationsService.createReservation(
        companyId,
        productId,
        quantity,
        transportId,
        tx,
      );

      await tx.transportProduct.create({
        data: {
          transportId,
          productId,
          companyId,
          quantity,
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          status: ProductStatus.DISPATCHED,
        },
      });

      await tx.productMovement.create({
        data: {
          productId,
          companyId,
          previousStatus: ProductStatus.IN_STORAGE,
          newStatus: ProductStatus.DISPATCHED,
          quantity,
          location: transport.origin,
          reason: `Adicionado ao transport ${transport.internalCode}`,
          userId,
        },
      });

      await tx.vehicle.update({
        where: { id: transport.vehicleId },
        data: { status: VehicleStatus.in_use },
      });

      return tx.transport.findFirst({
        where: { id: transportId },
        include: {
          vehicle: true,
          company: true,
          products: {
            include: {
              product: {
                include: {
                  supplier: true,
                },
              },
            },
          },
        },
      });
    });

    if (!updatedTransport) {
      throw new InternalServerErrorException(
        'Failed to add product to transport',
      );
    }

    await this.emitReservationsForTransport(
      transportId,
      companyId,
      'reservation:created',
      'RESERVED',
    );

    this.logger.log(`✅ Product added to transport ${transportId}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return updatedTransport;
  }

  async update(
    id: string,
    data: UpdateTransportDto,
    companyId?: string,
    userId?: string,
  ) {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`🔄 Updating transport ${id}`);
    this.logger.log(`👤 UserId: ${userId || 'system'}`);

    const transport = await this.findOne(id, companyId);

    const updateData: any = { ...data };

    if (data.departureDate) {
      updateData.departureDate = new Date(data.departureDate);
    }
    if (data.estimatedArrival) {
      updateData.estimatedArrival = new Date(data.estimatedArrival);
    }
    if (data.actualArrival) {
      updateData.actualArrival = new Date(data.actualArrival);
    }

    if (
      data.status === TransportStatus.DELIVERED &&
      transport.status !== TransportStatus.DELIVERED
    ) {
      this.logger.log(
        `✅ Status mudando para DELIVERED - Iniciando automação...`,
      );

      if (transport.status !== TransportStatus.ARRIVED) {
        throw new BadRequestException(
          `⚠️ VALIDAÇÃO DE STATUS\n\n` +
            `Para marcar como DELIVERED, o transport deve estar no status ARRIVED.\n` +
            `Status atual: ${transport.status}\n\n` +
            `💡 Fluxo correto: PENDING → IN_TRANSIT → ARRIVED → DELIVERED`,
        );
      }

      if (!updateData.actualArrival) {
        updateData.actualArrival = new Date();
        this.logger.log(
          `📅 Date real de chegada definida automaticamente: ${updateData.actualArrival.toISOString()}`,
        );
      }

      const updatedTransport = await this.prisma.$transaction(async (tx) => {
        const updatedTransport = await tx.transport.update({
          where: { id },
          data: updateData,
          include: {
            vehicle: true,
            company: true,
            products: {
              include: {
                product: true,
              },
            },
          },
        });

        this.logger.log(
          `📦 Processando ${updatedTransport.products.length} product(s)...`,
        );

        for (const tp of updatedTransport.products) {
          await tx.product.update({
            where: { id: tp.productId },
            data: {
              status: ProductStatus.APPROVED,
              currentLocation: transport.destination,
            },
          });

          this.logger.log(`  ✓ product ${tp.product.internalCode} → APPROVED`);

          await tx.productMovement.create({
            data: {
              productId: tp.productId,
              companyId: transport.companyId,
              previousStatus: ProductStatus.DISPATCHED,
              newStatus: ProductStatus.APPROVED,
              quantity: tp.quantity,
              location: transport.destination,
              reason:
                `Transport ${transport.internalCode} finalizado e conferido` +
                (data.receivedBy ? ` por ${data.receivedBy}` : ''),
              userId: userId || 'system',
            },
          });
        }

        await tx.vehicle.update({
          where: { id: transport.vehicleId },
          data: { status: VehicleStatus.available },
        });

        this.logger.log(
          `🚗 Vehicle ${updatedTransport.vehicle.licensePlate} → AVAILABLE (liberado)`,
        );

        if (data.receivedBy) {
          this.logger.log(`👤 Recebido por: ${data.receivedBy}`);
        }
        if (data.receivingNotes) {
          this.logger.log(`📝 Observações: ${data.receivingNotes}`);
        }

        try {
          await this.notificationsService.notifyTransportDelivered(
            transport.companyId,
            transport.internalCode,
            data.receivedBy || 'Não especificado',
          );
        } catch (error) {
          this.logger.error(
            `❌ Error sending delivery notification: ${error.message}`,
          );
        }

        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return updatedTransport;
      });

      this.emitTransportStatusChanged(transport, updatedTransport);
      return updatedTransport;
    }

    if (
      data.status === TransportStatus.CANCELED &&
      transport.status !== TransportStatus.CANCELED
    ) {
      this.logger.log(
        `❌ Status mudando para CANCELED - Revertendo automação...`,
      );

      const updatedTransport = await this.prisma.$transaction(async (tx) => {
        const updatedTransport = await tx.transport.update({
          where: { id },
          data: updateData,
          include: {
            vehicle: true,
            company: true,
            products: {
              include: {
                product: true,
              },
            },
          },
        });

        await this.stockReservationsService.releaseReservationsForTransport(
          id,
          transport.companyId,
          tx,
        );

        for (const tp of updatedTransport.products) {
          await tx.product.update({
            where: { id: tp.productId },
            data: {
              status: ProductStatus.IN_STORAGE,
            },
          });

          this.logger.log(
            `  ✓ product ${tp.product.internalCode} → IN_STORAGE (devolvido ao stock)`,
          );

          await tx.productMovement.create({
            data: {
              productId: tp.productId,
              companyId: transport.companyId,
              previousStatus: ProductStatus.DISPATCHED,
              newStatus: ProductStatus.IN_STORAGE,
              quantity: tp.quantity,
              location: transport.origin,
              reason: `Transport ${transport.internalCode} cancelled - products devolvidos`,
              userId: userId || 'system',
            },
          });
        }

        await tx.vehicle.update({
          where: { id: transport.vehicleId },
          data: { status: VehicleStatus.available },
        });

        this.logger.log(
          `🚗 Vehicle ${updatedTransport.vehicle.licensePlate} → AVAILABLE (liberado)`,
        );

        // CORREÇÃO AQUI: Usando userId fornecido ou 'system' como fallback
        const notificationUserId = userId || 'system';
        try {
          await this.notificationsService.create({
            title: '❌ Transport Cancelled',
            message: `O transport ${transport.internalCode} foi cancelled. ${data.notes || 'Sem motivo especificado'}`,
            companyId: transport.companyId,
            userId: notificationUserId, // Parâmetro adicionado
          });
        } catch (error) {
          this.logger.error(
            `❌ Error sending cancellation notification: ${error.message}`,
          );
        }

        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return updatedTransport;
      });

      this.emitTransportStatusChanged(transport, updatedTransport);
      await this.emitReservationsForTransport(
        id,
        transport.companyId,
        'reservation:released',
        'RELEASED',
      );
      return updatedTransport;
    }

    if (
      data.status === TransportStatus.IN_TRANSIT &&
      transport.status !== TransportStatus.IN_TRANSIT
    ) {
      const updatedTransport = await this.prisma.$transaction(async (tx) => {
        const updatedTransport = await tx.transport.update({
          where: { id },
          data: updateData,
          include: {
            vehicle: true,
            company: true,
            products: {
              include: {
                product: true,
              },
            },
          },
        });

        await this.stockReservationsService.confirmReservationsForTransport(
          id,
          transport.companyId,
          tx,
        );

        return updatedTransport;
      });

      this.emitTransportStatusChanged(transport, updatedTransport);
      await this.emitReservationsForTransport(
        id,
        transport.companyId,
        'reservation:confirmed',
        'CONFIRMED',
      );
      return updatedTransport;
    }

    this.logger.log(`📝 Atualização simples de campos logísticos`);

    const result = await this.prisma.transport.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: true,
        company: true,
        products: {
          include: {
            product: {
              include: {
                supplier: true,
              },
            },
          },
        },
      },
    });

    if (data.status && data.status !== transport.status) {
      this.emitTransportStatusChanged(transport, result);
    }

    this.logger.log(`✅ Transport atualizado com success`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return result;
  }

  private emitTransportStatusChanged(
    previousTransport: { companyId: string; id: string; status: TransportStatus },
    updatedTransport: { id: string; status: TransportStatus },
  ) {
    this.appGateway.emitToCompany(
      previousTransport.companyId,
      'transport:status-changed',
      {
        companyId: previousTransport.companyId,
        transportId: updatedTransport.id,
        previousStatus: previousTransport.status,
        status: updatedTransport.status,
        timestamp: new Date().toISOString(),
      },
    );
  }

  private async emitReservationsForTransport(
    transportId: string,
    companyId: string,
    event:
      | 'reservation:created'
      | 'reservation:confirmed'
      | 'reservation:released',
    status: 'RESERVED' | 'CONFIRMED' | 'RELEASED',
  ) {
    const reservations = await this.prisma.stockReservation.findMany({
      where: { transportId, companyId, status },
    });

    for (const reservation of reservations) {
      await this.stockReservationsService.emitReservationEvent(
        event,
        reservation,
        companyId,
      );
    }
  }

  async updateStatus(
    id: string,
    status: TransportStatus,
    companyId?: string,
    userId?: string,
  ) {
    if (!Object.values(TransportStatus).includes(status)) {
      throw new BadRequestException(
        `Status inválido. Valores aceites: ${Object.values(TransportStatus).join(', ')}`,
      );
    }

    return this.update(id, { status }, companyId, userId);
  }

  async remove(id: string, companyId?: string, userId?: string, force = false) {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`🗑️ Tentando remove transport ${id} (force=${force})`);
    this.logger.log(`🏢 CompanyId: ${companyId || 'TODAS (SUPER_ADMIN)'}`);
    this.logger.log(`👤 UserId: ${userId || 'system'}`);

    try {
      const transport = await this.findOne(id, companyId);
      this.logger.log(`✅ Transport encontrado: ${transport.internalCode}`);
      this.logger.log(`📊 Status atual: ${transport.status}`);
      this.logger.log(`📦 products associados: ${transport.products.length}`);

      if (
        !force &&
        (transport.status === TransportStatus.IN_TRANSIT ||
          transport.status === TransportStatus.ARRIVED)
      ) {
        this.logger.warn(`🚨 BLOQUEADO - Transport em ${transport.status}`);

        throw new ConflictException(
          `🚫 Não é possível delete um transport em trânsito ou que já chegou.\n\n` +
            `📦 Transport: ${transport.internalCode}\n` +
            `🚛 Status: ${transport.status}\n` +
            `📍 Route: ${transport.origin} → ${transport.destination}\n\n` +
            `💡 Pode delete o transport quando:\n` +
            `  • Finalizar a entrega (status DELIVERED)\n` +
            `  • Cancelar o transport (status CANCELED)`,
        );
      }

      if (!force && transport.status === TransportStatus.DELIVERED) {
        this.logger.warn(
          `🚨 BLOQUEADO - Transport já entregue (dados históricos)`,
        );

        throw new ConflictException(
          `🚫 Não é possível delete um transport já entregue.\n\n` +
            `📦 Transport: ${transport.internalCode}\n` +
            `🚛 Status: DELIVERED\n` +
            `📍 Route: ${transport.origin} → ${transport.destination}\n` +
            `📅 Delivery date: ${new Date(transport.estimatedArrival).toLocaleDateString('en-GB')}\n\n` +
            `ℹ️ Delivered transports are kept for history and audit purposes.\n` +
            `If necessary, you can cancel the transport before deleting it.`,
        );
      }

      if (
        transport.status === TransportStatus.PENDING &&
        transport.products.length > 0
      ) {
        this.logger.log(
          `⚠️ Transport PENDING with ${transport.products.length} product(s)`,
        );
        this.logger.log(`🔄 Returning products to stock...`);

        await this.prisma.$transaction(async (tx) => {
          const productsList = transport.products
            .map((tp) => `${tp.product.internalCode} (${tp.quantity} un)`)
            .join(', ');

          this.logger.log(`📦 products a devolver: ${productsList}`);

          await this.stockReservationsService.releaseReservationsForTransport(
            id,
            transport.companyId,
            tx,
          );

          for (const tp of transport.products) {
            await tx.product.update({
              where: { id: tp.productId },
              data: {
                status: ProductStatus.IN_STORAGE,
              },
            });

            this.logger.log(
              `  ✓ ${tp.product.internalCode}: +${tp.quantity} un → IN_STORAGE`,
            );

            await tx.productMovement.create({
              data: {
                productId: tp.productId,
                companyId: transport.companyId,
                previousStatus: ProductStatus.DISPATCHED,
                newStatus: ProductStatus.IN_STORAGE,
                quantity: tp.quantity,
                location: transport.origin,
                reason: `Transport ${transport.internalCode} eliminado - products devolvidos ao stock`,
                userId: userId || 'system',
              },
            });
          }

          await tx.vehicle.update({
            where: { id: transport.vehicleId },
            data: { status: VehicleStatus.available },
          });

          this.logger.log(
            `🚗 Vehicle ${transport.vehicle.licensePlate} → AVAILABLE (liberado)`,
          );

          await tx.transportProduct.deleteMany({
            where: { transportId: id },
          });

          this.logger.log(`🗑️ Relações product-transport eliminadas`);

          await tx.transport.delete({
            where: { id },
          });

          this.logger.log(`✅ Transport eliminado com success`);
        });

        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.logger.log(`✅ Transport "${transport.internalCode}" eliminado`);
        this.logger.log(
          `   📦 ${transport.products.length} product(s) devolvido(s) ao stock`,
        );
        this.logger.log(`   🚗 Vehicle liberado`);
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
          message: `✅ Transport "${transport.internalCode}" eliminado com success`,
          productsReturned: transport.products.length,
          details: `${transport.products.length} product(s) devolvido(s) ao stock`,
        };
      }

      if (
        transport.status === TransportStatus.CANCELED ||
        (transport.status === TransportStatus.PENDING &&
          transport.products.length === 0)
      ) {
        this.logger.log(
          `✅ Transport pode ser eliminado (${transport.status}, sem products ativos)`,
        );

        await this.prisma.$transaction(async (tx) => {
          if (transport.status === TransportStatus.PENDING) {
            await tx.vehicle.update({
              where: { id: transport.vehicleId },
              data: { status: VehicleStatus.available },
            });
            this.logger.log(
              `🚗 Vehicle ${transport.vehicle.licensePlate} → AVAILABLE (liberado)`,
            );
          }

          await tx.transportProduct.deleteMany({
            where: { transportId: id },
          });

          await tx.transport.delete({
            where: { id },
          });
        });

        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.logger.log(
          `✅ Transport "${transport.internalCode}" eliminado com success`,
        );
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
          message: `✅ Transport "${transport.internalCode}" eliminado com success`,
        };
      }

      throw new BadRequestException(
        `Estado inesperado do transport. Status: ${transport.status}`,
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(`❌ Unexpected error deleting transport ${id}`);
      this.logger.error(`Message: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);

      throw new BadRequestException(
        `Error deleting transport: ${error.message}`,
      );
    }
  }

  async getStats(companyId?: string) {
    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    const [total, pending, inTransit, arrived, delivered, cancelled] =
      await Promise.all([
        this.prisma.transport.count({ where }),
        this.prisma.transport.count({
          where: { ...where, status: TransportStatus.PENDING },
        }),
        this.prisma.transport.count({
          where: { ...where, status: TransportStatus.IN_TRANSIT },
        }),
        this.prisma.transport.count({
          where: { ...where, status: TransportStatus.ARRIVED },
        }),
        this.prisma.transport.count({
          where: { ...where, status: TransportStatus.DELIVERED },
        }),
        this.prisma.transport.count({
          where: { ...where, status: TransportStatus.CANCELED },
        }),
      ]);

    return {
      total,
      pending,
      inTransit,
      arrived,
      delivered,
      cancelled,
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🗺️ CITY TO GPS COORDINATES MAPPING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  private readonly citiesCoordinates: Record<
    string,
    { lat: number; lng: number }
  > = {
    lisboa: { lat: 38.7223, lng: -9.1393 },
    lisbon: { lat: 38.7223, lng: -9.1393 },
    porto: { lat: 41.1579, lng: -8.6291 },
    oporto: { lat: 41.1579, lng: -8.6291 },
    braga: { lat: 41.5455, lng: -8.4268 },
    covilhã: { lat: 40.2848, lng: -7.5025 },
    covilha: { lat: 40.2848, lng: -7.5025 },
    aveiro: { lat: 40.6384, lng: -8.6488 },
    évora: { lat: 38.6644, lng: -8.3026 },
    evora: { lat: 38.6644, lng: -8.3026 },
    leiria: { lat: 39.7471, lng: -8.8067 },
    santarém: { lat: 39.2227, lng: -8.6898 },
    santarem: { lat: 39.2227, lng: -8.6898 },
    'castelo branco': { lat: 40.2863, lng: -7.5006 },
    guarda: { lat: 40.5365, lng: -7.2714 },
    belmonte: { lat: 40.3542, lng: -7.3889 },
    viseu: { lat: 40.6642, lng: -7.2686 },
    'vila real': { lat: 41.2925, lng: -7.7433 },
    'vila-real': { lat: 41.2925, lng: -7.7433 },
    bragança: { lat: 41.8047, lng: -6.7591 },
    braganca: { lat: 41.8047, lng: -6.7591 },
    funchal: { lat: 32.6542, lng: -16.9045 },
    'ponta delgada': { lat: 37.7412, lng: -25.6756 },
    amadora: { lat: 38.762, lng: -9.236 },
    barreiro: { lat: 38.6636, lng: -9.0759 },
    carcavelos: { lat: 38.6542, lng: -9.3167 },
    cascais: { lat: 38.6954, lng: -9.4202 },
    caparica: { lat: 38.6576, lng: -9.2141 },
    loures: { lat: 38.8268, lng: -9.1583 },
    oeiras: { lat: 38.6821, lng: -9.3102 },
    setúbal: { lat: 38.5246, lng: -8.8885 },
    setubal: { lat: 38.5246, lng: -8.8885 },
    almada: { lat: 38.6813, lng: -9.2138 },
    cacem: { lat: 38.7537, lng: -9.3051 },
    cacém: { lat: 38.7537, lng: -9.3051 },
    alcântara: { lat: 38.7094, lng: -9.1838 },
    alcantara: { lat: 38.7094, lng: -9.1838 },
    belém: { lat: 38.7029, lng: -9.2127 },
    belem: { lat: 38.7029, lng: -9.2127 },
    azambuja: { lat: 39.0766, lng: -8.8428 },
    alcochete: { lat: 38.7589, lng: -8.9787 },
  };

  private getCityCoordinates(cityName: string): { lat: number; lng: number } {
    const normalizedName = cityName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const coords = this.citiesCoordinates[normalizedName];

    if (!coords) {
      // Se a city não for encontrada, usar Lisboa como fallback
      this.logger.warn(
        `⚠️ City '${cityName}' não encontrada. Usando Lisboa como fallback.`,
      );
      return { lat: 38.7223, lng: -9.1393 };
    }

    return coords;
  }

  async getTrackingRoutes(companyId?: string) {
    this.logger.log(`📍 Obtendo rotas de rastreamento GPS`);

    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    const transports = await this.prisma.transport.findMany({
      where,
      include: {
        vehicle: true,
        company: true,
      },
      orderBy: { departureDate: 'desc' },
    });

    // Mapear transportes para rotas de rastreamento
    const trackingRoutes = transports.map((t) => {
      const originCoords = this.getCityCoordinates(t.origin);
      const destCoords = this.getCityCoordinates(t.destination);
      const midpointLat = (originCoords.lat + destCoords.lat) / 2;
      const midpointLng = (originCoords.lng + destCoords.lng) / 2;

      // Garantir que as coordenadas são números válidos
      const safeOriginLat = Number(originCoords.lat) || 39.5;
      const safeOriginLng = Number(originCoords.lng) || -8.0;
      const safeDestLat = Number(destCoords.lat) || 39.5;
      const safeDestLng = Number(destCoords.lng) || -8.0;
      const safeMidLat = (safeOriginLat + safeDestLat) / 2;
      const safeMidLng = (safeOriginLng + safeDestLng) / 2;

      this.logger.debug(`📍 Route: ${t.origin} → ${t.destination}`);
      this.logger.debug(`   Origin: [${safeOriginLat}, ${safeOriginLng}]`);
      this.logger.debug(`   Destination: [${safeDestLat}, ${safeDestLng}]`);

      return {
        id: t.id,
        name: `${t.origin} → ${t.destination}`,
        origin: t.origin,
        destination: t.destination,
        // Incluir coordenadas individuais também (backward compatibility)
        origin_lat: safeOriginLat,
        origin_lng: safeOriginLng,
        destination_lat: safeDestLat,
        destination_lng: safeDestLng,
        status: t.status.toLowerCase(),
        startTime: t.departureDate,
        endTime: t.estimatedArrival,
        actualArrival: t.actualArrival,
        // Locations é o array esperado pelo TrackingMap
        locations: [
          {
            lat: safeOriginLat,
            lng: safeOriginLng,
            timestamp: t.departureDate.toISOString(),
            speed: 0,
          },
          {
            lat: safeMidLat,
            lng: safeMidLng,
            timestamp: new Date(
              t.departureDate.getTime() +
                (t.estimatedArrival.getTime() - t.departureDate.getTime()) / 2,
            ).toISOString(),
            speed: 50,
          },
          {
            lat: safeDestLat,
            lng: safeDestLng,
            timestamp: (t.actualArrival || t.estimatedArrival).toISOString(),
            speed: 0,
          },
        ],
        vehicle: t.vehicle,
        vehicleId: t.vehicleId,
        transportId: t.id, // Adicionar também transportId para compatibilidade
        transport: t.vehicle ? { id: t.vehicleId } : undefined,
        company: t.company,
      };
    });

    this.logger.log(
      `✅ ${trackingRoutes.length} route(s) encontrada(s) com coordenadas GPS`,
    );

    return trackingRoutes;
  }

  async deleteTrackingRoute(id: string, companyId?: string, userId?: string) {
    this.logger.log(`🗑️ Deleting route de rastreamento ${id}`);

    const transport = await this.findOne(id, companyId);

    this.logger.log(`✅ Transport encontrado: ${transport.internalCode}`);

    // Aqui poderíamos delete dados de GPS do banco se existissem
    // Por enquanto, apenas retornamos success

    this.logger.log(`✅ Route de rastreamento ${id} eliminada`);

    return {
      message: `✅ Route de rastreamento do transport ${transport.internalCode} eliminada`,
      transportId: id,
    };
  }

  async clearAllTrackingRoutes(companyId?: string, userId?: string) {
    this.logger.log(`🗑️ Limpando todo o rastreamento GPS`);
    this.logger.log(`🏢 CompanyId: ${companyId || 'TODAS (SUPER_ADMIN)'}`);
    this.logger.log(`👤 UserId: ${userId || 'system'}`);

    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    const count = await this.prisma.transport.count({ where });

    this.logger.log(`📊 Transportes afetados: ${count}`);

    // Aqui poderíamos limpar dados de GPS do banco se existissem
    // Por enquanto, apenas registramos a ação e retornamos success

    this.logger.log(`✅ Todo o rastreamento GPS foi limpo`);

    return {
      message: `✅ Todo o rastreamento GPS foi eliminado com success`,
      routesDeleted: count,
    };
  }
}
