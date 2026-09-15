import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isStockRoute =
      request.method === 'GET' &&
      (request.url?.includes('/products/stock') ||
        request.originalUrl?.includes('/products/stock'));

    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(` TenantGuard - ${method} ${url}`);

    if (isPublic) {
      this.logger.log(
        '🔓 Public route detected - allowing request to reach route-level guards',
      );
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return true;
    }

    if (isStockRoute) {
      this.logger.log(
        '📦 Stock route detected without user - allowing ApiKeyGuard to validate headers',
      );
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return true;
    }

    // Check se usuário existe
    if (!user) {
      this.logger.error(' Unauthenticated user');
      throw new ForbiddenException('Utilizador não autenticado');
    }

    this.logger.log(`👤 User: ${user.email} | Role: ${user.role}`);

    // SUPER_ADMIN has full access WITHOUT companyId validation
    if (user.role === Role.SUPER_ADMIN) {
      this.logger.log('⭐ SUPER_ADMIN detectado - access total permitido');
      this.logger.log(`   🌐 Can access ALL companies`);

      // For SUPER_ADMIN, available in request but NOT injected in body
      request.companyId = user.companyId || null;
      request.userId = user.id;

      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return true;
    }

    // For ADMIN and OPERATOR: validate mandatory companyId
    if (!user.companyId) {
      this.logger.error(
        ` User ${user.email} (${user.role}) without associated company`,
      );
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      throw new ForbiddenException('User without associated company');
    }

    this.logger.log(`🏢 User companyId: ${user.companyId}`);

    //  CORRIGIDO: NÃO injeta no body, apenas valida se vier
    if (['POST', 'PATCH', 'PUT'].includes(method) && request.body) {
      // Validate if trying to manipulate date from another company
      if (request.body.companyId && request.body.companyId !== user.companyId) {
        this.logger.error(
          ` User ${user.email} tried to manipulate company ${request.body.companyId}`,
        );
        this.logger.error(`   🏢 User company: ${user.companyId}`);
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        throw new ForbiddenException(
          'Não pode manipular dados de outra company',
        );
      }

      // REMOVED: No longer injected in body (causes validation error)
      // request.body.companyId = user.companyId;
      // request.body.userId = user.id;

      this.logger.debug(` Validation de tenant OK`);
    }

    // Validates companyId in params (e.g.: /products/:companyId/...)
    if (
      request.params?.companyId &&
      request.params.companyId !== user.companyId
    ) {
      this.logger.error(
        ` User ${user.email} tried to access company ${request.params.companyId}`,
      );
      this.logger.error(`   🏢 Company do user: ${user.companyId}`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      throw new ForbiddenException('Não pode aceder dados de outra company');
    }

    //  Disponibiliza companyId e userId diretamente no request (não no body)
    request.companyId = user.companyId;
    request.userId = user.id;

    this.logger.log(` Tenant OK - ${user.email} | Company: ${user.companyId}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    return true;
  }
}
