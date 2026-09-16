import { Injectable } from '@nestjs/common';
import { AuditLogRepository } from '../../database/repositories/audit-log.repository';
import { FilterAuditLogDto } from './dto/filter-audit-log.dto';

@Injectable()
export class AuditLogService {
  constructor(private auditLogRepository: AuditLogRepository) {}

  async findAll(
    companyId: string,
    filters?: FilterAuditLogDto & { page?: number; limit?: number },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (filters?.action) where.action = filters.action;
    if (filters?.entity) where.entity = filters.entity;
    if (filters?.userId) where.userId = filters.userId;

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    // Buscar logs com paginação e incluir usuário
    const [logs, totalItems] = await Promise.all([
      this.auditLogRepository.findAllWithPagination(where, skip, limit),
      this.auditLogRepository.count(where),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      logs,
      totalItems,
      totalPages,
      currentPage: page,
    };
  }

  async findByEntity(entity: string, entityId: string, companyId: string) {
    return this.auditLogRepository.findByEntity(entity, entityId);
  }

  async findByUser(userId: string, companyId: string) {
    return this.auditLogRepository.findByUser(userId);
  }

  async getActionStats(companyId: string) {
    // Total de ações
    const totalActions = await this.auditLogRepository.count({ companyId });

    // Ações por tipo
    const actionsByTypeRaw =
      await this.auditLogRepository.getActionStats(companyId);
    const actionsByType = actionsByTypeRaw.map((item) => ({
      action: item.action,
      count: item._count,
    }));

    // Ações por entidade
    const actionsByEntityRaw =
      await this.auditLogRepository.getEntityStats(companyId);
    const actionsByEntity = actionsByEntityRaw.map((item) => ({
      entity: item.entity,
      count: item._count,
    }));

    // Top usuários
    const topUsersRaw = await this.auditLogRepository.getTopUsers(companyId);
    const topUsers = topUsersRaw.map((item) => ({
      userId: item.userId,
      userName: item.user?.name || 'Desconhecido',
      userEmail: item.user?.email || 'N/A',
      count: item._count,
    }));

    return {
      totalActions,
      actionsByType,
      actionsByEntity,
      topUsers,
    };
  }

  async createLog(data: {
    action: string;
    entity: string;
    entityId?: string;
    userId: string;
    companyId: string | null;
    ipAddress?: string;
    metadata?: any;
  }) {
    return this.auditLogRepository.createLog({
      action: data.action,
      entity: data.entity,
      entityId: data.entityId || undefined,
      userId: data.userId,
      companyId: data.companyId,
      ipAddress: data.ipAddress || undefined,
      data: data.metadata || undefined,
    });
  }

  async clearAllLogs(companyId: string): Promise<number> {
    // Deletes all logs from the company via repository
    try {
      const deletedCount =
        await this.auditLogRepository.deleteAllByCompany(companyId);
      console.log(
        `[AuditLog] Deleted ${deletedCount} logs for company ${companyId}`,
      );
      return deletedCount;
    } catch (error) {
      console.error(
        `[AuditLog] Error clearing logs for company ${companyId}:`,
        error,
      );
      throw error;
    }
  }

  async deleteLog(id: string, companyId: string): Promise<boolean> {
    // Verify that the log belongs to the company before deleting
    const log = await this.auditLogRepository.findById(id);
    if (!log || log.companyId !== companyId) {
      return false;
    }
    await this.auditLogRepository.deleteById(id);
    return true;
  }
}
