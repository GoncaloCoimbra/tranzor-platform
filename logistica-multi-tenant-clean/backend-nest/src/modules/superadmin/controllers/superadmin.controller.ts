import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SuperadminService } from '../superadmin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('superadmin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  // ← Mudei aqui de SuperadminController para SuperAdminController
  constructor(private readonly superadminService: SuperadminService) {}

  @Get('stats')
  async getGlobalStats() {
    return this.superadminService.getGlobalStats();
  }

  @Get('companies')
  async getAllCompanies() {
    return this.superadminService.getAllCompanies();
  }

  @Get('users')
  async getAllUsers() {
    return this.superadminService.getAllUsers();
  }

  @Post('users')
  async createUser(@Body() data: any) {
    return this.superadminService.createUser(data);
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() data: any) {
    return this.superadminService.updateUser(id, data);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.superadminService.deleteUser(id);
  }

  @Get('companies/:id')
  async getCompany(@Param('id') id: string) {
    return this.superadminService.getCompany(id);
  }

  @Get('companies/:id/stats')
  async getCompanyStats(@Param('id') id: string) {
    return this.superadminService.getCompanyStats(id);
  }

  @Post('companies')
  async createCompany(@Body() data: any) {
    return this.superadminService.createCompany(data);
  }

  @Patch('companies/:id')
  async updateCompany(@Param('id') id: string, @Body() data: any) {
    return this.superadminService.updateCompany(id, data);
  }

  @Patch('companies/:id/status')
  async toggleCompanyStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.superadminService.toggleCompanyStatus(id, isActive);
  }

  @Delete('companies/:id')
  async deleteCompany(@Param('id') id: string) {
    return this.superadminService.deleteCompany(id);
  }
}
