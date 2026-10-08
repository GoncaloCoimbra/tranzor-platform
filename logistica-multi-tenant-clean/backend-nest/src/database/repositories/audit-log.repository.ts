import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import { AuditLog } from '@prisma/client';

@Injectable()
export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor(prisma: PrismaService) {
    super(prisma, 'auditLog');
  }

  async findAllWithPagination(where: any, skip: number, take: number) {
    return this.prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async count(where: any): Promise<number> {
    return this.prisma.auditLog.count({ where });
  }

  async findByUser(userId: string, companyId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { userId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    companyId: string,
  ): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { entity: entityType, entityId, companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findByCompany(companyId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async createLog(data: any) {
    return this.create(data);
  }

  async getActionStats(companyId: string) {
    return this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { companyId },
      _count: true,
      orderBy: {
        _count: {
          action: 'desc',
        },
      },
    });
  }

  async getEntityStats(companyId: string) {
    return this.prisma.auditLog.groupBy({
      by: ['entity'],
      where: { companyId },
      _count: true,
      orderBy: {
        _count: {
          entity: 'desc',
        },
      },
    });
  }

  async getTopUsers(companyId: string) {
    const result = await this.prisma.auditLog.groupBy({
      by: ['userId'],
      where: { companyId },
      _count: true,
      orderBy: {
        _count: {
          userId: 'desc',
        },
      },
      take: 10,
    });

    // Buscar informações dos usuários
    const userIds = result.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    return result.map((r) => ({
      userId: r.userId,
      _count: r._count,
      user: users.find((u) => u.id === r.userId),
    }));
  }

  async deleteAllByCompany(companyId: string) {
    const res = await this.prisma.auditLog.deleteMany({ where: { companyId } });
    return res.count || 0;
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.findOne({ id });
  }

  async deleteById(id: string): Promise<AuditLog> {
    return this.delete({ id });
  }
}
