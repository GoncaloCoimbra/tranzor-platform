import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Vehicle, Prisma } from '@prisma/client';

@Injectable()
export class VehicleRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId?: string): Promise<Vehicle[]> {
    const where = companyId ? { companyId } : {};

    return this.prisma.vehicle.findMany({ where });
  }

  async findById(id: string, companyId?: string): Promise<Vehicle | null> {
    const where = companyId ? { id, companyId } : { id };

    return this.prisma.vehicle.findFirst({
      where,
    });
  }

  async findOne(id: string, companyId?: string): Promise<Vehicle | null> {
    const where = companyId ? { id, companyId } : { id };

    return this.prisma.vehicle.findFirst({
      where,
    });
  }

  async findByCompany(companyId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: { companyId },
    });
  }

  async findByCompanyId(companyId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: { companyId },
    });
  }

  async findByLicensePlate(
    licensePlate: string,
    companyId?: string,
  ): Promise<Vehicle | null> {
    const where = companyId ? { licensePlate, companyId } : { licensePlate };

    return this.prisma.vehicle.findFirst({
      where,
    });
  }

  async findAvailable(companyId?: string): Promise<Vehicle[]> {
    const where: Prisma.VehicleWhereInput = companyId ? { companyId } : {};

    return this.prisma.vehicle.findMany({ where });
  }

  async create(data: Prisma.VehicleCreateInput): Promise<Vehicle> {
    return this.prisma.vehicle.create({ data });
  }

  async update(id: string, data: Prisma.VehicleUpdateInput): Promise<Vehicle> {
    return this.prisma.vehicle.update({
      where: { id },
      data,
    });
  }

  async updateStatus(id: string, status: any): Promise<Vehicle> {
    return this.prisma.vehicle.update({
      where: { id },
      data: { status },
    });
  }

  async delete(id: string): Promise<Vehicle> {
    return this.prisma.vehicle.delete({
      where: { id },
    });
  }
}
