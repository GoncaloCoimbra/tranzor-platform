import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey =
      request.headers?.['x-api-key'] ||
      request.headers?.['X-API-Key'] ||
      request.get?.('x-api-key');

    if (!apiKey) {
      throw new UnauthorizedException(
        'Missing X-API-Key header. Please provide a valid API key.',
      );
    }

    const validatedApiKey = await this.apiKeysService.validateApiKey(apiKey);

    if (!validatedApiKey?.companyId) {
      throw new UnauthorizedException('Invalid or revoked X-API-Key.');
    }

    request.companyId = validatedApiKey.companyId;
    request.user = {
      ...(request.user || {}),
      companyId: validatedApiKey.companyId,
    };

    return true;
  }
}
