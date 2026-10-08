import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

interface UserPayload {
  id: string;
  companyId: string | null;
  email: string;
  role: Role;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
    @CurrentUser() user: UserPayload,
  ) {
    // SEMPRE usa o userId e companyId do token, ignorando o body
    // Isso garante segurança e evita problemas com ValidationPipe
    const userId = user.id;
    const companyId = user.companyId;

    if (!companyId) {
      throw new Error(
        'SUPER_ADMIN cannot create notifications without specifying a company',
      );
    }

    try {
      const result = await this.notificationsService.create({
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        userId: userId,
        companyId: companyId,
      });

      return result;
    } catch (error) {
      console.error(' Error in controller:', error.message);
      throw error;
    }
  }

  @Get('test')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async test(@CurrentUser() user: UserPayload) {
    return {
      message: 'Test endpoint working',
      user: {
        id: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      },
      timestamp: new Date(),
    };
  }

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async findAll(@CurrentUser() user: UserPayload) {
    // SUPER_ADMIN pode ver todas as notificações (companyId = null)
    // ADMIN/OPERATOR see only from their company
    return this.notificationsService.findByCompany(user.companyId);
  }

  @Get('unread')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async findUnread(@CurrentUser() user: UserPayload) {
    return this.notificationsService.findUnreadByCompany(user.companyId);
  }

  @Get('unread/count')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async countUnread(@CurrentUser() user: UserPayload) {
    const count = await this.notificationsService.countUnread(user.companyId);
    return { count };
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: UserPayload) {
    return this.notificationsService.markAllAsRead(user.companyId);
  }

  // Alias para compatibilidade com frontend antigo
  @Patch('mark-all-read')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async markAllAsReadAlias(@CurrentUser() user: UserPayload) {
    return this.notificationsService.markAllAsRead(user.companyId);
  }

  @Delete('all')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeAll(@CurrentUser() user: UserPayload) {
    // Delete all notifications from the company
    const companyId = user.companyId;
    if (!companyId) {
      throw new Error(
        'SUPER_ADMIN cannot delete all notifications without specifying a company',
      );
    }

    const result = await this.prisma.notification.deleteMany({
      where: { companyId },
    });

    console.log(
      `🗑️  Deleted ${result.count} notifications for company ${companyId}`,
    );

    return {
      success: true,
      deleted: result.count,
      message: `${result.count} notificações foram eliminadas`,
    };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.notificationsService.delete(id);
    return {
      success: true,
      message: 'Notificação eliminada com sucesso',
      id,
    };
  }
}
