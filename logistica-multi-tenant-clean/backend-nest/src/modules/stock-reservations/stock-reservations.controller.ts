import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StockReservationsService } from './stock-reservations.service';
import { ListStockReservationsDto } from './dto/list-stock-reservations.dto';
import { CreateStockReservationDto } from './dto/create-stock-reservation.dto';

@ApiTags('Reservations')
@ApiBearerAuth()
@Controller('reservations')
@UseGuards(RolesGuard, TenantGuard)
export class StockReservationsController {
  constructor(
    private readonly stockReservationsService: StockReservationsService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Criar uma reserva para a company autenticada' })
  create(
    @Body() body: CreateStockReservationDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.stockReservationsService.createReservation(
      user.companyId,
      body.productId,
      body.quantity,
      body.transportId,
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Listar reservas da company autenticada' })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query() query: ListStockReservationsDto,
  ) {
    return this.stockReservationsService.findAll(user.companyId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Obter uma reserva da company autenticada' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.stockReservationsService.findOne(id, user.companyId);
  }
}