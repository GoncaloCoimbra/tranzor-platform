// src/common/interceptors/audit-log.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
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

    console.log('[INTERCEPTOR] Executed!');
    console.log('[INTERCEPTOR] Method:', method);
    console.log('[INTERCEPTOR] URL:', url);
    console.log('[INTERCEPTOR] User:', user ? user.email : 'NO USER');
    console.log('[INTERCEPTOR] Body:', JSON.stringify(body));

    // Apenas captura ações relevantes
    const shouldLog = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    console.log('[INTERCEPTOR] Should log?', shouldLog);
    console.log('[INTERCEPTOR] Has user?', !!user);

    if (!shouldLog || !user) {
      console.log(
        '⚠️ [INTERCEPTOR] Skipping log - shouldLog:',
        shouldLog,
        'user:',
        !!user,
      );
      return next.handle();
    }

    console.log(' [INTERCEPTOR] Will process the log!');

    return next.handle().pipe(
      tap(async (response) => {
        console.log(
          '[INTERCEPTOR TAP] Response received:',
          JSON.stringify(response),
        );

        try {
          const { entity, action } = this.extractEntityAndAction(method, url);
          console.log('[INTERCEPTOR] Entity:', entity, 'Action:', action);

          if (!entity) {
            console.log(
              '⚠️ [INTERCEPTOR] Nenhuma entity encontrada, saindo...',
            );
            return;
          }

          //  EXTRAÇÃO MELHORADA DO ID DA ENTIDADE
          const entityId = this.extractEntityId(response, body, url);
          console.log('[INTERCEPTOR] Entity ID extracted:', entityId);

          const ipAddress = request.ip || request.connection?.remoteAddress;

          // Registra no audit log
          console.log('[INTERCEPTOR] Calling auditLogService.createLog...');
          await this.auditLogService.createLog({
            action,
            entity,
            entityId: entityId || undefined,
            userId: user.id,
            companyId: user.companyId,
            ipAddress: ipAddress ? String(ipAddress) : undefined,
            metadata: {
              method,
              url,
              body: this.sanitizeBody(body),
            },
          });

          this.logger.log(
            ` [AUDIT] ${action} ${entity}${entityId ? ` (${entityId})` : ''} by ${user.email}`,
          );
        } catch (error) {
          this.logger.error(
            ` [AUDIT ERROR] Could not register audit: ${error.message}`,
            error.stack,
          );
          // DOES NOT fail the request if audit log fails
        }
      }),
      catchError((error) => {
        const errorDetail =
          error?.response ||
          (typeof error?.getResponse === 'function'
            ? error.getResponse()
            : undefined) ||
          error?.message ||
          'Unknown error';
        try {
          console.log(
            ' [INTERCEPTOR] Error na requisição (detalhes):',
            JSON.stringify(errorDetail),
          );
        } catch (e) {
          console.log(
            ' [INTERCEPTOR] Error na requisição (detalhes):',
            errorDetail,
          );
        }

        // If there is an error in the request, also tries to register
        try {
          if (user) {
            const { entity, action } = this.extractEntityAndAction(method, url);
            if (entity) {
              const errMsg =
                typeof errorDetail === 'string'
                  ? errorDetail
                  : errorDetail?.message || JSON.stringify(errorDetail);
              this.logger.warn(
                `⚠️ [AUDIT] ${action} ${entity} falhou - ${errMsg}`,
              );
            }
          }
        } catch (auditError) {
          // Silently ignores audit errors during errors
        }

        // For diagnosis, also log the stack if present
        if (error && error.stack) {
          this.logger.debug(` [INTERCEPTOR] Stack: ${error.stack}`);
        }

        throw error; // IMPORTANT: Propagates the original error
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

  private sanitizeBody(body: any): any {
    if (!body) return null;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'refreshToken', 'secret'];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***HIDDEN***';
      }
    });

    return sanitized;
  }
}
