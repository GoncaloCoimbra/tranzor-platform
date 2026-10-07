import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from '../products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { FilterProductDto } from '../dto/filter-product.dto';
import { ListProductsDto } from '../dto/list-products.dto';
import { UpdateProductStatusDto } from '../dto/update-product-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { Role } from '@prisma/client';
import { ApiKeyGuard } from '../../api-keys/api-key.guard';

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Create  new product' })
  create(@Body() createProductDto: CreateProductDto, @CurrentUser() user: any) {
    console.log('🔍 [CONTROLLER] Body recebido:', createProductDto);
    console.log('🔍 [CONTROLLER] User:', {
      id: user.id,
      companyId: user.companyId,
    });

    return this.productsService.create(
      createProductDto,
      user.companyId,
      user.id,
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Listar todos os products' })
  findAll(@CurrentUser() user: any, @Query() filters: ListProductsDto) {
    return this.productsService.findAll(user.companyId, filters);
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Estatísticas por estado' })
  getStats(@CurrentUser() user: any) {
    return this.productsService.getStatsByStatus(user.companyId);
  }

  @Get('stock')
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: 'Consulta de stock para integração ChatOps' })
  async getStockBySku(@Query('sku') sku: string, @Req() request: any) {
    return this.productsService.getStockBySku(sku, request.companyId);
  }

  @Get('low-stock')
  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: 'Listar produtos com cinco ou menos unidades para integração ChatOps' })
  async getLowStock(@Req() request: any) {
    return this.productsService.getLowStock(request.companyId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get product por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findOne(id, user.companyId);
  }

  @Get(':id/movements')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get histórico de movimentos' })
  findWithMovements(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findWithMovements(id, user.companyId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Update product' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.update(
      id,
      updateProductDto,
      user.companyId,
      user.id,
    );
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Update estado do product' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateProductStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.updateStatus(
      id,
      updateStatusDto,
      user.companyId,
      user.id,
    );
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete product' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.companyId, user.id);
  }
}
