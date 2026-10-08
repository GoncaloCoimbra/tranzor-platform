// src/modules/transports/controllers/transports.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Logger,
  Request,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { TransportsService } from '../transports.service';
import { CreateTransportDto } from '../dto/create-transport.dto';
import { UpdateTransportDto } from '../dto/update-transport.dto';
import { AddTransportProductDto } from '../dto/add-transport-product.dto';
import { ListTransportsDto } from '../dto/list-transports.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role, TransportStatus } from '@prisma/client';

@Controller('transports')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class TransportsController {
  private readonly logger = new Logger(TransportsController.name);

  constructor(private readonly transportsService: TransportsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async create(@Body() createTransportDto: CreateTransportDto, @Request() req) {
    const user = req.user;
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`📥 POST /transports`);
    this.logger.log(`👤 User: ${user.email} (${user.role})`);
    this.logger.log(
      `🏢 CompanyId: ${user.companyId || 'SUPER_ADMIN - sem company'}`,
    );
    this.logger.log(`📋 DTO recebido: ${JSON.stringify(createTransportDto)}`);

    const companyId = createTransportDto.companyId || user.companyId;

    if (!companyId) {
      this.logger.error(' CompanyId não encontrado');
      throw new HttpException('CompanyId obrigatório', HttpStatus.BAD_REQUEST);
    }

    //  CORREÇÃO: Passar user.id (userId) para o service
    const result = await this.transportsService.create(
      createTransportDto,
      companyId,
      user.id, // ← ADICIONAR userId
    );

    this.logger.log(` Transport criado: ${result.id}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return result;
  }

  @Post(':id/add-product')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async addProduct(
    @Param('id') id: string,
    @Body() addProductDto: AddTransportProductDto,
    @Request() req,
  ) {
    const user = req.user;
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`📥 POST /transports/${id}/add-product`);
    this.logger.log(`👤 User: ${user.email} (${user.role})`);

    const companyId = user.companyId;
    if (!companyId) {
      this.logger.error(' CompanyId não encontrado');
      throw new HttpException('CompanyId obrigatório', HttpStatus.BAD_REQUEST);
    }

    const result = await this.transportsService.addProduct(
      id,
      addProductDto.productId,
      addProductDto.quantity ?? 1,
      companyId,
      user.id,
    );

    this.logger.log(` Product added to transport: ${result.id}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return result;
  }

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  findAll(
    @Request() req,
    @Query() filters: ListTransportsDto,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const user = req.user;
    this.logger.log(`📥 GET /transports - User: ${user.email} (${user.role})`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.transportsService.findAll(companyId, filters);
  }

  @Get('pending')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  findPending(@Request() req, @Query('companyId') queryCompanyId?: string) {
    const user = req.user;
    this.logger.log(`📥 GET /transports/pending - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.transportsService.findPending(companyId);
  }

  @Get('in-transit')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  findInTransit(@Request() req, @Query('companyId') queryCompanyId?: string) {
    const user = req.user;
    this.logger.log(`📥 GET /transports/in-transit - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? queryCompanyId : user.companyId;

    return this.transportsService.findInTransit(companyId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string, @Request() req) {
    const user = req.user;
    this.logger.log(`📥 GET /transports/${id} - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId;

    return this.transportsService.findOne(id, companyId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateTransportDto: UpdateTransportDto,
    @Request() req,
  ) {
    const user = req.user;
    this.logger.log(`📥 PATCH /transports/${id} - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId;

    //  CORREÇÃO: Passar user.id (userId) para o service
    return this.transportsService.update(
      id,
      updateTransportDto,
      companyId,
      user.id, // ← ADICIONAR userId
    );
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Request() req,
  ) {
    const user = req.user;
    this.logger.log(
      `📥 PATCH /transports/${id}/status - New status: ${body.status}`,
    );

    const companyId =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId;

    const status = body.status as TransportStatus;

    //  CORREÇÃO: Passar user.id (userId) para o service
    return this.transportsService.updateStatus(id, status, companyId, user.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async remove(
    @Param('id') id: string,
    @Request() req,
    @Query('force') force?: string,
  ) {
    const user = req.user;
    this.logger.log(`🗑️ DELETE /transports/${id} (force=${force})`);
    this.logger.log(`👤 User: ${user.email} (${user.role})`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId;

    const forceFlag = force === 'true' || force === '1' || force === 'yes';

    // Only admins or super admins may force-delete
    if (
      forceFlag &&
      user.role !== Role.ADMIN &&
      user.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Apenas utilizadores com privilégios de admin podem forçar a eliminação de transportes.',
      );
    }

    //  CORREÇÃO: Passar user.id (userId) para o service, e força quando aplicável
    return this.transportsService.remove(id, companyId, user.id, forceFlag);
  }

  @Get('tracking-routes/all')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async getTrackingRoutes(@Request() req) {
    const user = req.user;
    this.logger.log(`📍 GET /transports/tracking-routes - User: ${user.email}`);

    const companyId =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId;

    return this.transportsService.getTrackingRoutes(companyId);
  }

  @Delete('tracking-routes/clear-all')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async clearAllTrackingRoutes(@Request() req) {
    const user = req.user;
    this.logger.log(
      `🗑️ DELETE /transports/tracking-routes/clear-all - User: ${user.email}`,
    );

    const companyId =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId;

    return this.transportsService.clearAllTrackingRoutes(companyId, user.id);
  }

  @Delete('tracking-routes/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async deleteTrackingRoute(@Param('id') id: string, @Request() req) {
    const user = req.user;
    this.logger.log(
      `🗑️ DELETE /transports/tracking-routes/${id} - User: ${user.email}`,
    );

    const companyId =
      user.role === Role.SUPER_ADMIN ? undefined : user.companyId;

    return this.transportsService.deleteTrackingRoute(id, companyId, user.id);
  }
}
