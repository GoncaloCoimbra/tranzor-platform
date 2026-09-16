// src/modules/dashboard/dashboard.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';
import { Prisma, ProductStatus, StockReservationStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna TODAS as estatísticas necessárias para o Dashboard
   * Funciona para SUPER_ADMIN (sem companyId) e ADMIN/OPERATOR (com companyId)
   */
  async getStats(companyId?: string, filters?: DashboardFiltersDto) {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(
      ` Getting stats for company: ${companyId || 'ALL (SUPER_ADMIN)'}`,
    );

    // Cria where apenas se companyId existir
    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const dateRange = this.getDateRange(filters);
    if (dateRange) {
      where.createdAt = dateRange;
    }

    this.logger.log(` Where query: ${JSON.stringify(where)}`);

    try {
      // 1. CONTAGENS BÁSICAS (para os cards principais)

      const [
        totalProducts,
        totalSuppliers,
        totalVehicles,
        totalTransports,
        vehiclesAvailable,
        productsInStorage,
      ] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.supplier.count({ where }),
        this.prisma.vehicle.count({ where }),
        this.prisma.transport.count({ where }),
        this.prisma.vehicle.count({
          where: { ...where, status: 'available' },
        }),
        this.prisma.product.count({
          where: { ...where, status: ProductStatus.IN_STORAGE },
        }),
      ]);

      const stockReservationWhere = companyId ? { companyId } : {};
      const [reservedStock, reservationCount] = await Promise.all([
        this.prisma.stockReservation.aggregate({
          _sum: { quantity: true },
          where: {
            ...stockReservationWhere,
            status: {
              in: [
                StockReservationStatus.RESERVED,
                StockReservationStatus.CONFIRMED,
              ],
            },
          },
        }),
        this.prisma.stockReservation.count({
          where: stockReservationWhere,
        }),
      ]);
      const totalReservedQuantity = reservedStock._sum.quantity ?? 0;
      const totalProductQuantity =
        (await this.prisma.product.aggregate({
          _sum: { quantity: true },
          where,
        }))._sum.quantity ?? 0;
      const totalAvailableQuantity = Math.max(
        0,
        totalProductQuantity - totalReservedQuantity,
      );

      // 2. PRODUCTS BY STATUS (for pie chart)

      // 3. SUMMARY DETALHADO (para cards e gráfico de barras)

      // Os status disponíveis no Prisma são:
      // RECEIVED, IN_ANALYSIS, IN_STORAGE, APPROVED, DISPATCHED

      const movementDateRange = dateRange || this.getDateRange({ period: '30d' });

      const [productsByStatusRaw, received, inAnalysis, delivered, topSuppliers, recentMovements] =
        await Promise.all([
          this.prisma.product.groupBy({ by: ['status'], where, _count: true }),
          this.prisma.product.count({ where: { ...where, status: ProductStatus.RECEIVED } }),
          this.prisma.product.count({ where: { ...where, status: ProductStatus.IN_ANALYSIS } }),
          this.prisma.product.count({ where: { ...where, status: ProductStatus.DISPATCHED } }),
          this.getTopSuppliersForDashboard(companyId),
          this.prisma.product.count({ where: { ...where, updatedAt: movementDateRange } }),
        ]);

      const productsByStatus = productsByStatusRaw.map((p) => ({
        status: p.status,
        count: p._count,
      }));

      const summary = {
        received,
        inAnalysis,
        inStorage: productsInStorage,
        delivered,
        rejected: 0,
      };

      // 4. PERCENTAGENS (para mostrar nos cards)

      const percentages = {
        received:
          totalProducts > 0
            ? ((summary.received / totalProducts) * 100).toFixed(1)
            : '0',
        inStorage:
          totalProducts > 0
            ? ((summary.inStorage / totalProducts) * 100).toFixed(1)
            : '0',
        delivered:
          totalProducts > 0
            ? ((summary.delivered / totalProducts) * 100).toFixed(1)
            : '0',
        rejected:
          totalProducts > 0
            ? ((summary.rejected / totalProducts) * 100).toFixed(1)
            : '0',
      };

      // 5. TOP 5 FORNECEDORES (para a seção inferior)

      // 6. MONTA RESPOSTA COMPLETA

      const result = {
        totalProducts,
        totalSuppliers,
        totalVehicles,
        totalTransports,
        vehiclesAvailable,
        productsInStorage,
        reservationCount,
        reservedQuantity: totalReservedQuantity,
        availableQuantity: totalAvailableQuantity,
        productsByStatus,
        summary,
        percentages,
        topSuppliers,
        recentMovements,
      };

      // 8. LOGS DE DEBUG

      this.logger.log(`Stats computed successfully:`);
      this.logger.log(`    Total Products: ${totalProducts}`);
      this.logger.log(`   🏢 Total Suppliers: ${totalSuppliers}`);
      this.logger.log(`   🚗 Total Vehicles: ${totalVehicles}`);
      this.logger.log(`   🚚 Total Transports: ${totalTransports}`);
      this.logger.log(`   Vehicles Available: ${vehiclesAvailable}`);
      this.logger.log(`    Products In Storage: ${productsInStorage}`);
      this.logger.log(
        `    Products by Status: ${productsByStatus.length} categories`,
      );
      this.logger.log(`    Summary - Received: ${summary.received}`);
      this.logger.log(`    Summary - In Analysis: ${summary.inAnalysis}`);
      this.logger.log(`    Summary - In Storage: ${summary.inStorage}`);
      this.logger.log(
        `    Summary - Delivered (Dispatched): ${summary.delivered}`,
      );
      this.logger.log(`    Summary - Rejected: ${summary.rejected}`);
      this.logger.log(`   🔝 Top Suppliers: ${topSuppliers.length}`);
      this.logger.log(`   🔄 Recent Movements (30d): ${recentMovements}`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      return result;
    } catch (error) {
      this.logger.error(` Error computing stats: ${error.message}`);
      this.logger.error(` Stack: ${error.stack}`);
      throw error;
    }
  }

  private getDateRange(filters?: DashboardFiltersDto) {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    if (filters?.startDate || filters?.endDate) {
      start = filters.startDate ? new Date(filters.startDate) : undefined;
      end = filters.endDate ? new Date(filters.endDate) : undefined;
      if (end) end.setHours(23, 59, 59, 999);
    } else if (filters?.period) {
      const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[filters.period];
      if (days) {
        start = new Date(now);
        start.setDate(start.getDate() - days);
      }
    }

    if (!start && !end) return undefined;
    return { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
  }

  private async getTopSuppliersForDashboard(companyId?: string) {
    const rows = companyId
      ? await this.prisma.$queryRaw<Array<{ id: string; name: string; productCount: bigint }>>(
          Prisma.sql`SELECT s."id", s."name", COUNT(p."id") AS "productCount"
            FROM "Supplier" s
            LEFT JOIN "Product" p ON p."supplierId" = s."id" AND p."companyId" = ${companyId}
            WHERE s."companyId" = ${companyId}
            GROUP BY s."id", s."name"
            HAVING COUNT(p."id") > 0
            ORDER BY COUNT(p."id") DESC
            LIMIT 5`,
        )
      : await this.prisma.$queryRaw<Array<{ id: string; name: string; productCount: bigint }>>(
          Prisma.sql`SELECT s."id", s."name", COUNT(p."id") AS "productCount"
            FROM "Supplier" s
            LEFT JOIN "Product" p ON p."supplierId" = s."id"
            GROUP BY s."id", s."name"
            HAVING COUNT(p."id") > 0
            ORDER BY COUNT(p."id") DESC
            LIMIT 5`,
        );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      productCount: Number(row.productCount),
    }));
  }

  /**
   * Dashboard overview with filters
   */
  async getOverview(companyId?: string, filters?: DashboardFiltersDto) {
    this.logger.log(` Getting overview for company: ${companyId || 'ALL'}`);

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    return {
      message: 'Dashboard overview',
      companyId: companyId || 'ALL',
      filters,
    };
  }

  /**
   * Products grouped by status
   */
  async getProductsByStatus(companyId?: string) {
    this.logger.log(
      ` Getting products by status for company: ${companyId || 'ALL'}`,
    );

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const products = await this.prisma.product.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    return products.map((p) => ({
      status: p.status,
      count: p._count,
    }));
  }

  /**
   * Transportes agrupados por status
   */
  async getTransportsByStatus(companyId?: string) {
    this.logger.log(
      ` Getting transports by status for company: ${companyId || 'ALL'}`,
    );

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const transports = await this.prisma.transport.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    return transports.map((t) => ({
      status: t.status,
      count: t._count,
    }));
  }

  /**
   * Atividade recente (últimos 10 logs)
   */
  async getRecentActivity(companyId?: string) {
    this.logger.log(
      ` Getting recent activity for company: ${companyId || 'ALL'}`,
    );

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return logs;
  }

  /**
   * Estatísticas mensais
   */
  async getMonthlyStats(companyId?: string) {
    this.logger.log(
      ` Getting monthly stats for company: ${companyId || 'ALL'}`,
    );

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    return {
      message: 'Estatísticas mensais',
      companyId: companyId || 'ALL',
      data: [],
    };
  }

  /**
   * Top suppliers (with most products)
   */
  async getTopSuppliers(companyId?: string) {
    this.logger.log(
      ` Getting top suppliers for company: ${companyId || 'ALL'}`,
    );

    const where: any = {};
    if (companyId) {
      where.companyId = companyId;
    }

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: {
        products: {
          select: { id: true },
          where: companyId ? { companyId } : {},
        },
      },
    });

    return suppliers
      .map((s) => ({
        id: s.id,
        name: s.name,
        nif: s.nif,
        productCount: s.products.length,
      }))
      .filter((s) => s.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 5);
  }
}
