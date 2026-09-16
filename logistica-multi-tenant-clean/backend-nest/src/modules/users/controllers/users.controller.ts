import { Body, Controller, ForbiddenException, Get, Logger, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../../../users/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantGuard } from '../../auth/guards/tenant.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@ApiBearerAuth()
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users from the current company' })
  async findAll(@CurrentUser() user: any) {
    this.logger.log(`📋 Listing users for company: ${user.companyId}`);

    const users = await this.usersService.findByCompany(user.companyId);

    this.logger.log(
      `✅ Found ${users.length} users in company ${user.companyId}`,
    );

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      companyId: u.companyId,
    }));
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a user with strong password validation' })
  async update(@Param('id') id: string, @Body() data: any, @CurrentUser() user: any) {
    const target = await this.usersService.findById(id);
    if (!target || (user.role !== Role.SUPER_ADMIN && target.companyId !== user.companyId)) {
      throw new ForbiddenException('Cannot update a user from another company');
    }
    return this.usersService.update(id, data);
  }
}
