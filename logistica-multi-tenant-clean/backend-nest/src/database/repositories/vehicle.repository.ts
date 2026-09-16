import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Vehicle, Prisma } from '@prisma/client';

@Injectable()
export class VehicleRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({ where: { companyId } });
  }

  async findById(id: string, companyId: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({
      where: { id, companyId },
    });
  }

  async findOne(id: string, companyId: string): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({
      where: { id, companyId },
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
    companyId: string,
  ): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({
      where: { licensePlate, companyId },
    });
  }

  async findAvailable(companyId: string): Promise<Vehicle[]> {
    const where: Prisma.VehicleWhereInput = { companyId };

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
