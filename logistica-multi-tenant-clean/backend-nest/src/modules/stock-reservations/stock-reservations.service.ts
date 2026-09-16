import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, StockReservationStatus } from '@prisma/client';
import { RedisLockService } from './redis-lock.service';
import { Cron } from '@nestjs/schedule';
import { AppGateway } from '../../app.gateway';
import { ListStockReservationsDto } from './dto/list-stock-reservations.dto';

@Injectable()
export class StockReservationsService {
  private readonly logger = new Logger(StockReservationsService.name);
  private readonly stockQuantityEpsilon = 0.0001;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisLockService: RedisLockService,
    private readonly appGateway: AppGateway,
  ) {}

  /**
   * Estado do modelo de reserva de stock
   *
   * - Transport criado (PENDING) -> StockReservation criada com RESERVED.
   * - Transport despachado/em trânsito (IN_TRANSIT) -> StockReservation passa a CONFIRMED.
   * - Transport entregue (DELIVERED) -> StockReservation permanece CONFIRMED.
   *   (Não há um estado final adicional porque a reserva já representa a saída física do stock;
   *   manter CONFIRMED deixa explícito que a quantidade foi consumida e não está disponível.)
   * - Transport cancelado (CANCELED) -> StockReservation passa a RELEASED.
   * - expiresAt ultrapassado sem confirmação -> StockReservation passa a EXPIRED.
   *
   * Esta implementação apenas expõe os métodos de transição e validação de estados.
   * O job de expiração fica para o item 2.3/2.4.
   */
  private readonly reservationTtlMinutes = 30;

  async findAll(companyId: string, query: ListStockReservationsDto) {
    const where = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.transportId ? { transportId: query.transportId } : {}),
    };
    const skip = (query.page - 1) * query.limit;

    const [data, total] = await Promise.all([
      this.prisma.stockReservation.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: true,
          transport: true,
        },
      }),
      this.prisma.stockReservation.count({ where }),
    ]);

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(reservationId: string, companyId: string) {
    const reservation = await this.prisma.stockReservation.findFirst({
      where: {
        id: reservationId,
        companyId,
      },
      include: {
        product: true,
        transport: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException('Stock reservation not found');
    }

    return reservation;
  }

  async createReservation(
    companyId: string,
    productId: string,
    quantity: number,
    transportId?: string,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const lockKey = `stock:lock:${companyId}:${productId}`;
    let lockToken: string | null = null;

    try {
      if (transportId) {
        const transport = await prismaClient.transport.findFirst({
          where: { id: transportId, companyId },
          select: { id: true },
        });

        if (!transport) {
          throw new NotFoundException(
            `Transport ${transportId} not found for company ${companyId}.`,
          );
        }
      }

      lockToken = await this.redisLockService.acquireLock(lockKey);

      if (!lockToken) {
        throw new ConflictException(
          `Redis lock unavailable for product ${productId}. Reservation rejected to prevent overselling.`,
        );
      }

      const availableQuantity = await this.getAvailableQuantity(
        companyId,
        productId,
        prismaClient,
      );

      if (quantity > availableQuantity + this.stockQuantityEpsilon) {
        throw new ConflictException(
          `Insufficient stock for product ${productId}. Requested ${quantity}, available ${availableQuantity}.`,
        );
      }

      const expiresAt = new Date(
        Date.now() + this.reservationTtlMinutes * 60 * 1000,
      );

      const reservation = await prismaClient.stockReservation.create({
        data: {
          companyId,
          productId,
          transportId: transportId ?? null,
          quantity,
          status: StockReservationStatus.RESERVED,
          expiresAt,
        },
      });

      if (this.isRootClient(prismaClient)) {
        await this.emitReservationEvent(
          'stock:reservation-created',
          reservation,
          companyId,
        );
      }

      return reservation;
    } finally {
      if (lockToken) {
        await this.redisLockService.releaseLock(lockKey, lockToken);
      }
    }
  }

  private async getAvailableQuantity(
    companyId: string,
    productId: string,
    prismaClient: PrismaService | Prisma.TransactionClient,
  ) {
    const product = await prismaClient.product.findFirst({
      where: {
        id: productId,
        companyId,
      },
      select: {
        quantity: true,
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product ${productId} not found for company ${companyId}.`,
      );
    }

    const reservedQuantity = await prismaClient.stockReservation.aggregate({
      _sum: {
        quantity: true,
      },
      where: {
        companyId,
        productId,
        status: {
          in: [
            StockReservationStatus.RESERVED,
            StockReservationStatus.CONFIRMED,
          ],
        },
      },
    });

    const currentlyReserved = reservedQuantity._sum.quantity ?? 0;
    const availableQuantity = product.quantity - currentlyReserved;

    return this.normalizeAvailableQuantity(availableQuantity);
  }

  private normalizeAvailableQuantity(quantity: number): number {
    if (Math.abs(quantity) < this.stockQuantityEpsilon) {
      return 0;
    }

    return quantity;
  }

  async confirmReservation(
    reservationId: string,
    companyId: string,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const reservation = await prismaClient.stockReservation.findFirst({
      where: {
        id: reservationId,
        companyId,
      },
    });

    if (!reservation) {
      throw new NotFoundException(
        `Stock reservation ${reservationId} not found for company ${companyId}.`,
      );
    }

    if (reservation.status !== StockReservationStatus.RESERVED) {
      throw new BadRequestException(
        `Only RESERVED reservations can transition to CONFIRMED. Current status: ${reservation.status}`,
      );
    }

    const updatedReservation = await prismaClient.stockReservation.update({
      where: {
        id: reservationId,
        companyId,
      },
      data: {
        status: StockReservationStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    if (this.isRootClient(prismaClient)) {
      await this.emitReservationEvent(
        'stock:reservation-confirmed',
        updatedReservation,
        companyId,
      );
    }

    return updatedReservation;
  }

  async releaseReservation(
    reservationId: string,
    companyId: string,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const reservation = await prismaClient.stockReservation.findFirst({
      where: {
        id: reservationId,
        companyId,
      },
    });

    if (!reservation) {
      throw new NotFoundException(
        `Stock reservation ${reservationId} not found for company ${companyId}.`,
      );
    }

    if (
      reservation.status !== StockReservationStatus.RESERVED &&
      reservation.status !== StockReservationStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Only RESERVED or CONFIRMED reservations can transition to RELEASED. Current status: ${reservation.status}`,
      );
    }

    const updatedReservation = await prismaClient.stockReservation.update({
      where: {
        id: reservationId,
        companyId,
      },
      data: {
        status: StockReservationStatus.RELEASED,
        releasedAt: new Date(),
      },
    });

    if (this.isRootClient(prismaClient)) {
      await this.emitReservationEvent(
        'stock:reservation-released',
        updatedReservation,
        companyId,
      );
    }

    return updatedReservation;
  }

  async confirmReservationsForTransport(
    transportId: string,
    companyId: string,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const reservations = await prismaClient.stockReservation.findMany({
      where: { transportId, companyId },
      select: { id: true },
    });

    for (const reservation of reservations) {
      await this.confirmReservation(reservation.id, companyId, prismaClient);
    }

    return reservations.length;
  }

  async releaseReservationsForTransport(
    transportId: string,
    companyId: string,
    prismaClient: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    const reservations = await prismaClient.stockReservation.findMany({
      where: { transportId, companyId },
      select: { id: true },
    });

    for (const reservation of reservations) {
      await this.releaseReservation(reservation.id, companyId, prismaClient);
    }

    return reservations.length;
  }

  @Cron('0 */5 * * * *', {
    name: 'expire-stock-reservations',
    timeZone: 'Europe/Lisbon',
  })
  async expireReservations() {
    const expiredReservations = await this.prisma.$transaction(async (tx) => {
      const candidates = await tx.stockReservation.findMany({
        where: {
          status: StockReservationStatus.RESERVED,
          expiresAt: { lt: new Date() },
        },
      });
      const expired: Array<Prisma.StockReservationGetPayload<{}>> = [];

      for (const candidate of candidates) {
        const result = await tx.stockReservation.updateMany({
          where: {
            id: candidate.id,
            status: StockReservationStatus.RESERVED,
            expiresAt: { lt: new Date() },
          },
          data: { status: StockReservationStatus.EXPIRED },
        });

        if (result.count === 1) {
          expired.push({
            ...candidate,
            status: StockReservationStatus.EXPIRED,
          });
        }
      }

      return expired;
    });

    for (const reservation of expiredReservations) {
      await this.emitReservationEvent(
        'stock:reservation-expired',
        reservation,
        reservation.companyId,
      );
    }

    this.logger.log(
      `Expired ${expiredReservations.length} stock reservation(s)`,
    );
    return expiredReservations.length;
  }

  private isRootClient(
    prismaClient: PrismaService | Prisma.TransactionClient,
  ): prismaClient is PrismaService {
    return prismaClient === this.prisma;
  }

  async emitReservationEvent(
    event:
      | 'stock:reservation-created'
      | 'stock:reservation-confirmed'
      | 'stock:reservation-released'
      | 'stock:reservation-expired',
    reservation: {
      id: string;
      companyId: string;
      productId: string;
      quantity: number;
      status: StockReservationStatus;
      transportId?: string | null;
    },
    companyId: string,
  ) {
    const availableQuantity = await this.getAvailableQuantity(
      companyId,
      reservation.productId,
      this.prisma,
    );

    const timestamp = new Date().toISOString();
    await this.appGateway.emitToCompany(companyId, event, {
      companyId,
      reservationId: reservation.id,
      productId: reservation.productId,
      quantity: reservation.quantity,
      status: reservation.status,
      transportId: reservation.transportId ?? null,
      timestamp,
    });
    await this.appGateway.emitToCompany(companyId, 'stock:updated', {
      companyId,
      productId: reservation.productId,
      availableQuantity,
      timestamp,
    });
  }
}
