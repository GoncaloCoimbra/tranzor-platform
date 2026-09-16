// src/modules/vehicles/vehicles.service.ts

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { VehicleStatus, TransportStatus } from '@prisma/client';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: any, companyId: string) {
    try {
      this.logger.log(`????????????????????????????????????`);
      this.logger.log(`?? Creating vehicle for company: ${companyId}`);
      this.logger.log(`?? Received data: ${JSON.stringify(data)}`);

      // Validate campos obrigat�rios
      if (!data.licensePlate) {
        throw new BadRequestException('License plate is required');
      }
      if (!data.model) {
        throw new BadRequestException('Model is required');
      }
      if (!data.brand) {
        throw new BadRequestException('Brand is required');
      }
      if (!data.type) {
        throw new BadRequestException('Type is required');
      }
      if (!data.capacity && data.capacity !== 0) {
        throw new BadRequestException('Capacity is required');
      }
      if (!data.year) {
        throw new BadRequestException('Year is required');
      }

      // Normalizar matr�cula (removes espa�os, converter para mai�sculas)
      const normalizedPlate = data.licensePlate.trim().toUpperCase();
      this.logger.log(`?? License plate normalized: ${normalizedPlate}`);

      // Check se matr�cula already exists
      const existing = await this.prisma.vehicle.findFirst({
        where: {
          licensePlate: normalizedPlate,
          companyId,
        },
      });

      if (existing) {
        this.logger.error(` License plate ${normalizedPlate} already exists`);
        throw new ConflictException(
          'A vehicle with this license plate already exists',
        );
      }

      // Converter e validate n�meros
      let capacity: number;
      let year: number;

      try {
        capacity = Number(data.capacity);
        if (isNaN(capacity) || capacity < 0) {
          throw new Error('Invalid capacity');
        }
      } catch (error) {
        this.logger.error(`? Invalid capacity: ${data.capacity}`);
        throw new BadRequestException(
          'Capacity must be a valid number greater than or equal to 0',
        );
      }

      try {
        year = Number(data.year);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year < 1900 || year > currentYear + 1) {
          throw new Error('Invalid year');
        }
      } catch (error) {
        this.logger.error(`? Invalid year: ${data.year}`);
        const currentYear = new Date().getFullYear();
        throw new BadRequestException(
          `Year must be between 1900 and ${currentYear + 1}`,
        );
      }

      // Validate and normalize status
      let status = VehicleStatus.available;
      if (data.status) {
        const validStatuses = Object.values(VehicleStatus);
        if (!validStatuses.includes(data.status)) {
          this.logger.error(`? Invalid status: ${data.status}`);
          throw new BadRequestException(
            `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
          );
        }
        status = data.status;
      }

      // Preparar dados para cria��o
      const vehicleData = {
        licensePlate: normalizedPlate,
        model: data.model.trim(),
        brand: data.brand.trim(),
        type: data.type.trim(),
        capacity,
        year,
        status,
        companyId,
      };

      this.logger.log(
        `?? Formatted data for creation: ${JSON.stringify(vehicleData)}`,
      );

      // Create vehicle
      const vehicle = await this.prisma.vehicle.create({
        data: vehicleData,
        include: {
          company: true,
        },
      });

      this.logger.log(
        `? Vehicle created successfully: ${vehicle.licensePlate} (${vehicle.id})`,
      );
      this.logger.log(`????????????????????????????????????`);

      return vehicle;
    } catch (error) {
      this.logger.error(`? ERROR creating vehicle: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      throw error;
    }
  }

  async findAll(
    companyId?: string,
    filters?: {
      status?: VehicleStatus;
      type?: string;
    },
  ) {
    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    return this.prisma.vehicle.findMany({
      where,
      include: {
        company: true,
        transports: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAvailable(companyId?: string) {
    const where: any = {
      status: VehicleStatus.available,
    };

    if (companyId) {
      where.companyId = companyId;
    }

    return this.prisma.vehicle.findMany({
      where,
      include: {
        company: true,
      },
      orderBy: { licensePlate: 'asc' },
    });
  }

  async findOne(id: string, companyId?: string) {
    this.logger.log(`????????????????????????????????????`);
    this.logger.log(`?? Searching for vehicle ${id}`);
    this.logger.log(`?? CompanyId: ${companyId || 'ALL (SUPER_ADMIN)'}`);

    const where: any = { id };

    if (companyId) {
      where.companyId = companyId;
    }

    this.logger.log(`?? Query where: ${JSON.stringify(where)}`);

    const vehicle = await this.prisma.vehicle.findFirst({
      where,
      include: {
        company: true,
        transports: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!vehicle) {
      this.logger.error(`? Vehicle ${id} not found`);
      throw new NotFoundException('Vehicle not found');
    }

    this.logger.log(`? Vehicle found: ${vehicle.licensePlate}`);
    this.logger.log(`????????????????????????????????????`);

    return vehicle;
  }

  async update(id: string, data: any, companyId?: string) {
    try {
      this.logger.log(`????????????????????????????????????`);
      this.logger.log(`?? Updating vehicle ${id}`);
      this.logger.log(`?? CompanyId: ${companyId || 'ALL (SUPER_ADMIN)'}`);
      this.logger.log(`?? data received: ${JSON.stringify(data)}`);

      // Find the vehicle
      const vehicle = await this.findOne(id, companyId);
      this.logger.log(`? Vehicle found: ${vehicle.licensePlate}`);

      // Prepare update data
      const updateData: any = {};

      // Update license plate if provided
      if (data.licensePlate) {
        const normalizedPlate = data.licensePlate.trim().toUpperCase();

        // Check if different from current
        if (normalizedPlate !== vehicle.licensePlate) {
          this.logger.log(
            `?? Checking if license plate ${normalizedPlate} already exists...`,
          );

          const where: any = {
            licensePlate: normalizedPlate,
            NOT: { id },
          };

          if (companyId) {
            where.companyId = companyId;
          }

          const existing = await this.prisma.vehicle.findFirst({ where });

          if (existing) {
            this.logger.error(
              ` License plate ${normalizedPlate} already exists`,
            );
            throw new ConflictException('Matr�cula already exists');
          }

          this.logger.log(` License plate dispon�vel`);
          updateData.licensePlate = normalizedPlate;
        }
      }

      // Update outros campos
      if (data.model) updateData.model = data.model.trim();
      if (data.brand) updateData.brand = data.brand.trim();
      if (data.type) updateData.type = data.type.trim();

      // Converter n�meros
      if (data.capacity !== undefined) {
        const capacity = Number(data.capacity);
        if (isNaN(capacity) || capacity < 0) {
          throw new BadRequestException(
            'Capacity must be a valid number greater than or equal to 0',
          );
        }
        updateData.capacity = capacity;
      }

      if (data.year !== undefined) {
        const year = Number(data.year);
        if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
          throw new BadRequestException(
            `Year deve ser entre 1900 e ${new Date().getFullYear() + 1}`,
          );
        }
        updateData.year = year;
      }

      // Validate status
      if (data.status) {
        const validStatuses = Object.values(VehicleStatus);
        if (!validStatuses.includes(data.status)) {
          throw new BadRequestException(
            `Invalid status. Valores permitidos: ${validStatuses.join(', ')}`,
          );
        }
        updateData.status = data.status;
      }

      this.logger.log(
        `?? Dados para atualiza��o: ${JSON.stringify(updateData)}`,
      );

      // Update ve�culo
      const updated = await this.prisma.vehicle.update({
        where: { id },
        data: updateData,
        include: {
          company: true,
        },
      });

      this.logger.log(` Ve�culo ${id} atualizado com success`);
      this.logger.log(`????????????????????????????????????`);

      return updated;
    } catch (error) {
      this.logger.error(` ERRO ao update ve�culo: ${error.message}`);
      throw error;
    }
  }

  async updateStatus(id: string, status: VehicleStatus, companyId?: string) {
    await this.findOne(id, companyId);

    const validStatuses = Object.values(VehicleStatus);

    if (!validStatuses.includes(status)) {
      throw new ConflictException(
        `Invalid status. Valores permitidos: ${validStatuses.join(', ')}`,
      );
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: { status },
      include: {
        company: true,
      },
    });
  }

  async remove(id: string, companyId?: string) {
    this.logger.log(`????????????????????????????????????`);
    this.logger.log(`??? Tentando remove ve�culo ${id}`);
    this.logger.log(`?? CompanyId: ${companyId || 'ALL (SUPER_ADMIN)'}`);

    try {
      // 1?? Busca o ve�culo
      const vehicle = await this.findOne(id, companyId);
      this.logger.log(` Ve�culo encontrado: ${vehicle.licensePlate}`);

      // 2?? Verifica transportes ATIVOS (PENDING ou IN_TRANSIT)
      const activeTransports = await this.prisma.transport.findMany({
        where: {
          vehicleId: id,
          ...(companyId ? { companyId } : {}),
          status: {
            in: [TransportStatus.PENDING, TransportStatus.IN_TRANSIT],
          },
        },
        select: {
          internalCode: true,
          origin: true,
          destination: true,
          status: true,
        },
        take: 5,
      });

      this.logger.log(`?? Transportes ATIVOS: ${activeTransports.length}`);

      // ?? SE TIVER TRANSPORTES ATIVOS ? N�O PODE ELIMINAR
      if (activeTransports.length > 0) {
        this.logger.warn(
          `?? BLOQUEADO - Ve�culo tem ${activeTransports.length} transport(s) active(s)`,
        );

        const transportsList = activeTransports
          .map(
            (t) =>
              `${t.internalCode} (${t.origin} ? ${t.destination}) - Status: ${t.status}`,
          )
          .join(', ');

        throw new ConflictException(
          ` This vehicle cannot be deleted as it is being used in active transport(s).\n\n` +
            `?? Active transports (${activeTransports.length}):\n${transportsList}${activeTransports.length > 5 ? '...' : ''}\n\n` +
            `?? Pode delete o ve�culo quando:\n` +
            `  � Finalizar ou cancelar estes transportes\n` +
            `  � Atribuir outro ve�culo a estes transportes`,
        );
      }

      // 3?? Verifica se tem transportes finalizados (DELIVERED ou CANCELED)
      const finishedTransportsCount = await this.prisma.transport.count({
        where: {
          vehicleId: id,
          ...(companyId ? { companyId } : {}),
          status: {
            in: [TransportStatus.DELIVERED, TransportStatus.CANCELED],
          },
        },
      });

      this.logger.log(` Transportes finalizados: ${finishedTransportsCount}`);

      //  SE N�O TIVER TRANSPORTES ATIVOS ? PODE ELIMINAR
      if (finishedTransportsCount > 0) {
        this.logger.log(
          `?? O ve�culo tem ${finishedTransportsCount} transport(s) finalizado(s), mas pode ser eliminado`,
        );
      } else {
        this.logger.log(` No associated transport - proceeding with deletion`);
      }

      // 4?? Delete o ve�culo
      await this.prisma.vehicle.delete({
        where: { id },
      });

      this.logger.log(
        ` Vehicle "${vehicle.licensePlate}" (${id}) eliminado com success`,
      );
      this.logger.log(`????????????????????????????????????`);

      return {
        message: ` Vehicle "${vehicle.licensePlate}" deleted successfully`,
        finishedTransports: finishedTransportsCount,
      };
    } catch (error) {
      // Se j� � uma exce��o conhecida, propaga
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Log de error inesperado
      this.logger.error(` Error inesperado ao delete ve�culo ${id}`);
      this.logger.error(`Mensagem: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);

      throw new InternalServerErrorException(
        `Error ao delete ve�culo: ${error.message}`,
      );
    }
  }

  async getStats(companyId?: string) {
    const where: any = {};

    if (companyId) {
      where.companyId = companyId;
    }

    const [total, available, inUse, inMaintenance, retired] = await Promise.all(
      [
        this.prisma.vehicle.count({ where }),
        this.prisma.vehicle.count({
          where: { ...where, status: VehicleStatus.available },
        }),
        this.prisma.vehicle.count({
          where: { ...where, status: VehicleStatus.in_use },
        }),
        this.prisma.vehicle.count({
          where: { ...where, status: VehicleStatus.in_maintenance },
        }),
        this.prisma.vehicle.count({
          where: { ...where, status: VehicleStatus.retired },
        }),
      ],
    );

    return {
      total,
      available,
      inUse,
      inMaintenance,
      retired,
    };
  }
}
