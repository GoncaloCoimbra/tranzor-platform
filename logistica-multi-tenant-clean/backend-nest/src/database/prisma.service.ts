import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../common/tenant-context.service';
import { verifyStartupDependencies } from '../common/startup-dependencies';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly tenantContext: TenantContextService) {
    const databaseUrl = process.env.DATABASE_URL;
    const url = databaseUrl
      ? `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=20`
      : undefined;

    super(url ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleInit() {
    let connected = false;
    await verifyStartupDependencies(
      [
        {
          name: 'PostgreSQL',
          check: async () => {
            await this.$connect();
            await this.$queryRaw`SELECT 1`;
            connected = true;
          },
        },
      ],
      {
        onAttemptFailure: (name, attempt, error) =>
          this.logger.error(
            `Startup dependency ${name} attempt ${attempt} failed`,
            error instanceof Error ? error.stack : String(error),
          ),
        onDegraded: (name, error) =>
          this.logger.warn(
            `ALLOW_DEGRADED=true: continuing without ${name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
      },
    );
    if (connected) this.logger.log('Prisma connected to database');

    // Add middleware to inject companyId
    this.$use(async (params, next) => {
      const companyId = this.tenantContext.getCompanyId();

      if (companyId && this.shouldInjectCompanyId(params.model)) {
        params.args = params.args || {};

        // For queries, add where clause
        if (
          params.action === 'findUnique' ||
          params.action === 'findUniqueOrThrow' ||
          params.action === 'findFirst' ||
          params.action === 'findFirstOrThrow'
        ) {
          params.args.where = {
            ...params.args.where,
            companyId,
          };
        } else if (params.action === 'findMany') {
          params.args.where = {
            ...params.args.where,
            companyId,
          };
        } else if (params.action === 'create') {
          params.args.data = {
            ...params.args.data,
            companyId,
          };
        } else if (
          params.action === 'update' ||
          params.action === 'updateMany'
        ) {
          params.args.where = {
            ...params.args.where,
            companyId,
          };
          params.args.data = {
            ...params.args.data,
            companyId,
          };
        } else if (
          params.action === 'delete' ||
          params.action === 'deleteMany'
        ) {
          params.args.where = {
            ...params.args.where,
            companyId,
          };
        } else if (
          params.action === 'count' ||
          params.action === 'aggregate' ||
          params.action === 'groupBy'
        ) {
          params.args.where = {
            ...params.args.where,
            companyId,
          };
        } else if (
          params.action === 'createMany' ||
          params.action === 'createManyAndReturn'
        ) {
          params.args.data = Array.isArray(params.args.data)
            ? params.args.data.map((data) => ({ ...data, companyId }))
            : { ...params.args.data, companyId };
        } else if (params.action === 'upsert') {
          params.args.where = {
            ...params.args.where,
            companyId,
          };
          params.args.create = {
            ...params.args.create,
            companyId,
          };
          params.args.update = {
            ...params.args.update,
            companyId,
          };
        }
      }

      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log(' Prisma disconnected from database');
  }

  private shouldInjectCompanyId(model?: string): boolean {
    // Models that have companyId field
    const tenantModels = [
      'ApiKey',
      'User',
      'Supplier',
      'Product',
      'Vehicle',
      'Transport',
      'TransportProduct',
      'ProductMovement',
      'StockReservation',
      'ProcessedStockSyncEvent',
      'StockSyncDeadLetter',
      'AuditLog',
      'Settings',
      'Notification',
      'Task',
      'Referral',
    ];

    return model ? tenantModels.includes(model) : false;
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as string];
        if (model && typeof model.deleteMany === 'function') {
          return model.deleteMany();
        }
      }),
    );
  }
}
