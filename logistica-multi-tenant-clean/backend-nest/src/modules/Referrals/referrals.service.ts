import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReferralStatus } from '@prisma/client'; // ← MUDAR PARA PRISMA
import { CreateReferralDto } from './dto/create-referral.dto';
import {
  UpdateReferralDto,
  UpdateReferralStatusDto,
} from './dto/update-referral.dto';
import { FilterReferralDto } from './dto/filter-referral.dto';
import { ReferralStatsDto } from './dto/referrals.dto';
@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria uma nova referência
   */
  async create(
    createReferralDto: CreateReferralDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    // Verifica se SUPER_ADMIN está criando para uma company específica
    let companyId = userCompanyId;

    if (userRole === 'SUPER_ADMIN') {
      if (!createReferralDto.companyId) {
        throw new BadRequestException(
          'SUPER_ADMIN deve especificar o ID da company',
        );
      }
      companyId = createReferralDto.companyId;

      // Verifica se a company existe
      const companyExists = await this.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!companyExists) {
        throw new NotFoundException('Company não encontrada');
      }
    }

    // Converte a date para ISO string
    const referralDate = new Date(createReferralDto.referralDate);

    // Calcula comissão se não fornecida (5% do valor estimado)
    const commission =
      createReferralDto.commission !== undefined
        ? createReferralDto.commission
        : createReferralDto.estimatedValue * 0.05;

    // Cria a referência
    const referral = await this.prisma.referral.create({
      data: {
        clientName: createReferralDto.clientName,
        contactInfo: createReferralDto.contactInfo,
        referralSource: createReferralDto.referralSource || '',
        status: createReferralDto.status || ReferralStatus.NEW,
        projectType: createReferralDto.projectType,
        estimatedValue: createReferralDto.estimatedValue,
        referralDate: referralDate,
        notes: createReferralDto.notes || null,
        referredBy: createReferralDto.referredBy,
        commission: commission,
        companyId: companyId,
      },
    });

    return referral;
  }

  /**
   * Lista todas as referências com filtros opcionais
   */
  async findAll(
    filterDto: FilterReferralDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    const where: any = {};

    // SUPER_ADMIN pode ver todas as referências ou filter por company
    if (userRole === 'SUPER_ADMIN') {
      if (filterDto.companyId) {
        where.companyId = filterDto.companyId;
      }
    } else {
      // Outros usuários só veem referências da própria company
      where.companyId = userCompanyId;
    }

    // Aplica filtros adicionais
    if (filterDto.status) {
      where.status = filterDto.status;
    }

    if (filterDto.projectType) {
      where.projectType = filterDto.projectType;
    }

    if (filterDto.referralSource) {
      where.referralSource = {
        contains: filterDto.referralSource,
        mode: 'insensitive',
      };
    }

    if (filterDto.referredBy) {
      where.referredBy = {
        contains: filterDto.referredBy,
        mode: 'insensitive',
      };
    }

    if (filterDto.referralDateBefore || filterDto.referralDateAfter) {
      where.referralDate = {};
      if (filterDto.referralDateBefore) {
        where.referralDate.lte = new Date(filterDto.referralDateBefore);
      }
      if (filterDto.referralDateAfter) {
        where.referralDate.gte = new Date(filterDto.referralDateAfter);
      }
    }

    if (filterDto.search) {
      where.OR = [
        { clientName: { contains: filterDto.search, mode: 'insensitive' } },
        { notes: { contains: filterDto.search, mode: 'insensitive' } },
      ];
    }

    const referrals = await this.prisma.referral.findMany({
      where,
      orderBy: [{ referralDate: 'desc' }],
    });

    return referrals;
  }

  /**
   * Busca uma referência por ID
   */
  async findOne(
    id: string,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
    });

    if (!referral) {
      throw new NotFoundException('Referência não encontrada');
    }

    // Verifica permissões
    if (userRole !== 'SUPER_ADMIN' && referral.companyId !== userCompanyId) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar esta referência',
      );
    }

    return referral;
  }

  /**
   * Atualiza uma referência
   */
  async update(
    id: string,
    updateReferralDto: UpdateReferralDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    await this.findOne(id, userId, userRole, userCompanyId);

    const updateData: any = {};

    if (updateReferralDto.clientName !== undefined) {
      updateData.clientName = updateReferralDto.clientName;
    }

    if (updateReferralDto.contactInfo !== undefined) {
      updateData.contactInfo = updateReferralDto.contactInfo;
    }

    if (updateReferralDto.referralSource !== undefined) {
      updateData.referralSource = updateReferralDto.referralSource;
    }

    if (updateReferralDto.status !== undefined) {
      updateData.status = updateReferralDto.status;
    }

    if (updateReferralDto.projectType !== undefined) {
      updateData.projectType = updateReferralDto.projectType;
    }

    if (updateReferralDto.estimatedValue !== undefined) {
      updateData.estimatedValue = updateReferralDto.estimatedValue;
    }

    if (updateReferralDto.referralDate !== undefined) {
      updateData.referralDate = new Date(updateReferralDto.referralDate);
    }

    if (updateReferralDto.notes !== undefined) {
      updateData.notes = updateReferralDto.notes || null;
    }
    if (updateReferralDto.referredBy !== undefined) {
      updateData.referredBy = updateReferralDto.referredBy;
    }

    if (updateReferralDto.commission !== undefined) {
      updateData.commission = updateReferralDto.commission;
    }

    const updatedReferral = await this.prisma.referral.update({
      where: { id },
      data: updateData,
    });

    return updatedReferral;
  }

  /**
   * Atualiza apenas o status de uma referência
   */
  async updateStatus(
    id: string,
    updateStatusDto: UpdateReferralStatusDto,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    await this.findOne(id, userId, userRole, userCompanyId);

    const updatedReferral = await this.prisma.referral.update({
      where: { id },
      data: {
        status: updateStatusDto.status,
      },
    });

    return updatedReferral;
  }

  /**
   * Remove uma referência
   */
  async remove(
    id: string,
    userId: string,
    userRole: string,
    userCompanyId: string,
  ) {
    await this.findOne(id, userId, userRole, userCompanyId);

    await this.prisma.referral.delete({
      where: { id },
    });

    return { message: 'Referência excluída com success' };
  }

  /**
   * Obtém estatísticas das referências
   */
  async getStats(
    userId: string,
    userRole: string,
    userCompanyId: string,
    companyId?: string,
  ): Promise<ReferralStatsDto> {
    const where: any = {};

    if (userRole === 'SUPER_ADMIN' && companyId) {
      where.companyId = companyId;
    } else if (userRole !== 'SUPER_ADMIN') {
      where.companyId = userCompanyId;
    }

    const [total, newReferrals, contacted, converted, lost] = await Promise.all(
      [
        this.prisma.referral.count({ where }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.NEW },
        }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.CONTACTED },
        }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.CONVERTED },
        }),
        this.prisma.referral.count({
          where: { ...where, status: ReferralStatus.LOST },
        }),
      ],
    );

    // Calcular valores totais
    const allReferrals = await this.prisma.referral.findMany({
      where,
      select: {
        estimatedValue: true,
        commission: true,
      },
    });

    const totalEstimatedValue = allReferrals.reduce(
      (sum, ref) => sum + ref.estimatedValue,
      0,
    );
    const totalCommission = allReferrals.reduce(
      (sum, ref) => sum + (ref.commission || 0),
      0,
    );
    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    return {
      total,
      new: newReferrals,
      contacted,
      converted,
      lost,
      totalEstimatedValue,
      totalCommission,
      conversionRate: Number(conversionRate.toFixed(2)),
    };
  }
}
