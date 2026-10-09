// src/common/interceptors/audit-log.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const user = request.user;
    const body = request.body;

    // Apenas captura ações relevantes
    const shouldLog = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!shouldLog || !user) {
      return next.handle();
    }

    return next.handle().pipe(
      concatMap(async (response) => {
        try {
          const { entity, action } = this.extractEntityAndAction(method, url);

          if (!entity) {
            return;
          }

          //  EXTRAÇÃO MELHORADA DO ID DA ENTIDADE
          const entityId = this.extractEntityId(response, body, url);

          await this.auditLogService.createLog({
            action,
            entity,
            entityId: entityId || undefined,
            userId: user.id,
            companyId: user.companyId,
            metadata: {
              method,
            },
          });

          this.logger.log(
            ` [AUDIT] ${action} ${entity}${entityId ? ` (${entityId})` : ''} by user ${user.id}`,
          );
        } catch (error) {
          this.logger.error(
            ' [AUDIT ERROR] Could not register audit event',
            error.stack,
          );
        }
        return response;
      }),
      catchError((error) => {
        try {
          if (user) {
            const { entity, action } = this.extractEntityAndAction(method, url);
            if (entity) {
              this.logger.warn(`⚠️ [AUDIT] ${action} ${entity} request failed`);
            }
          }
        } catch {
          this.logger.warn('⚠️ [AUDIT] Could not classify failed request');
        }

        throw error;
      }),
    );
  }

  /**
   *  NOVA FUNÇÃO: Extrai o ID da entidade de múltiplas fontes
   */
  private extractEntityId(
    response: any,
    body: any,
    url: string,
  ): string | null {
    // 1️⃣ Tenta na resposta direta
    if (response && typeof response === 'object') {
      // Tenta: response.id
      if (response.id) {
        return String(response.id);
      }

      // Tenta: response.data.id (padrão comum)
      if (
        response.data &&
        typeof response.data === 'object' &&
        response.data.id
      ) {
        return String(response.data.id);
      }

      // Tenta: response.product.id, response.user.id, etc.
      const possibleKeys = [
        'product',
        'user',
        'vehicle',
        'transport',
        'supplier',
        'company',
        'setting',
      ];
      for (const key of possibleKeys) {
        if (
          response[key] &&
          typeof response[key] === 'object' &&
          response[key].id
        ) {
          return String(response[key].id);
        }
      }
    }

    // 2️⃣ Tenta no body da requisição (útil para PUTs/PATCHs)
    if (body && body.id) {
      return String(body.id);
    }

    // 3️⃣ Tenta extrair da URL (último recurso)
    const idFromUrl = this.extractIdFromUrl(url);
    if (idFromUrl) {
      return idFromUrl;
    }

    // ⚠️ Não encontrou ID
    return null;
  }

  private extractEntityAndAction(
    method: string,
    url: string,
  ): { entity: string | null; action: string } {
    // Remove query params
    const cleanUrl = url.split('?')[0];

    // Ignora rotas especiais (stats, available, export, etc)
    if (cleanUrl.match(/\/(stats|available|export|report|search|count)$/)) {
      return { entity: null, action: 'UNKNOWN' };
    }

    const entities = [
      'products',
      'users',
      'companies',
      'vehicles',
      'transports',
      'suppliers',
      'settings',
      'notifications',
    ];

    let entity: string | null = null;
    for (const e of entities) {
      if (cleanUrl.includes(`/${e}`)) {
        entity = e.slice(0, -1); // Remove o 's' final
        break;
      }
    }

    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    return {
      entity,
      action: actionMap[method] || 'UNKNOWN',
    };
  }

  private extractIdFromUrl(url: string): string | null {
    // Remove query params
    const cleanUrl = url.split('?')[0];

    // Tenta extrair UUID ou ID da URL
    const patterns = [
      /\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\/|$)/i, // UUID
      /\/(\d+)(?:\/|$)/, // Numeric ID
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}
