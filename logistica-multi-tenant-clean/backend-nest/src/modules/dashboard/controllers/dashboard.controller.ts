// src/modules/dashboard/controllers/dashboard.controller.ts

import {
  Controller,
  Get,
  UseGuards,
  Query,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from '../dashboard.service';
import { DashboardFiltersDto } from '../dto/dashboard-filters.dto';

//  CAMINHOS CORRIGIDOS
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@ApiBearerAuth()
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN) //  SUPER_ADMIN adicionado
  @ApiOperation({ summary: 'Estatísticas do dashboard' })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'Filter por company (SUPER_ADMIN)',
  })
  getStats(
    @Request() req,
    @Query() filters: DashboardFiltersDto,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user;
    this.logger.log(
      `📥 GET /dashboard/stats - User: ${user.email} (${user.role})`,
    );

    //  SUPER_ADMIN pode filter por company via query
    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.dashboardService.getStats(companyId, filters);
  }

  @Get('overview')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN) //  SUPER_ADMIN adicionado
  @ApiOperation({ summary: 'Dashboard overview' })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'Filter por company (SUPER_ADMIN)',
  })
  getOverview(
    @Request() req,
    @Query() filters: DashboardFiltersDto,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user;
    this.logger.log(
      `📥 GET /dashboard/overview - User: ${user.email} (${user.role})`,
    );

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.dashboardService.getOverview(companyId, filters);
  }

  @Get('products-by-status')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN) //  SUPER_ADMIN adicionado
  @ApiOperation({ summary: 'Products by status' })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'Filter por company (SUPER_ADMIN)',
  })
  getProductsByStatus(
    @Request() req,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user;
    this.logger.log(
      `📥 GET /dashboard/products-by-status - User: ${user.email}`,
    );

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.dashboardService.getProductsByStatus(companyId);
  }

  @Get('transports-by-status')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN) //  SUPER_ADMIN adicionado
  @ApiOperation({ summary: 'Transports by status' })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'Filter por company (SUPER_ADMIN)',
  })
  getTransportsByStatus(
    @Request() req,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user;
    this.logger.log(
      `📥 GET /dashboard/transports-by-status - User: ${user.email}`,
    );

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.dashboardService.getTransportsByStatus(companyId);
  }

  @Get('recent-activity')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN) //  SUPER_ADMIN adicionado
  @ApiOperation({ summary: 'Atividade recente' })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'Filter por company (SUPER_ADMIN)',
  })
  getRecentActivity(
    @Request() req,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user;
    this.logger.log(`📥 GET /dashboard/recent-activity - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.dashboardService.getRecentActivity(companyId);
  }

  @Get('monthly-stats')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN) //  SUPER_ADMIN adicionado
  @ApiOperation({ summary: 'Estatísticas mensais' })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'Filter por company (SUPER_ADMIN)',
  })
  getMonthlyStats(@Request() req, @Query('companyId') queryCompanyId?: string) {
    const user = req.user;
    this.logger.log(`📥 GET /dashboard/monthly-stats - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.dashboardService.getMonthlyStats(companyId);
  }

  @Get('top-suppliers')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN) //  SUPER_ADMIN adicionado
  @ApiOperation({ summary: 'Top fornecedores' })
  @ApiQuery({
    name: 'companyId',
    required: false,
    description: 'Filter por company (SUPER_ADMIN)',
  })
  getTopSuppliers(@Request() req, @Query('companyId') queryCompanyId?: string) {
    const user = req.user;
    this.logger.log(`📥 GET /dashboard/top-suppliers - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.dashboardService.getTopSuppliers(companyId);
  }
}
