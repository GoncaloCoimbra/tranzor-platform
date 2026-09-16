import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [DatabaseModule],
  providers: [ApiKeysService, ApiKeyGuard],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
