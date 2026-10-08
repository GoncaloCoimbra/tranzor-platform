// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './controllers/app.controller';
import { AppService } from './app.service';

// DATABASE MODULES

import { DatabaseModule } from './database/database.module';

// MODULES IN SRC/ ROOT

import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { TransportsModule } from './transports/transports.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { SettingsModule } from './settings/settings.module';
import { RegistrationModule } from './registration/registration.module';

// MODULES INSIDE SRC/MODULES/

import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProductsModule } from './modules/products/products.module';
import { SuperadminModule } from './modules/superadmin/superadmin.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ReferralsModule } from './modules/Referrals/referrals.module';
import { TutorialsModule } from './modules/tutorials/tutorials.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { StockReservationsModule } from './modules/stock-reservations/stock-reservations.module';
import { RealtimeModule } from './modules/realtime/realtime.module';

// GUARDS, FILTERS, INTERCEPTORS

import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { LoggingInterceptor } from '@common/interceptors/logging.interceptor';
import { AuditLogInterceptor } from '@common/interceptors/audit-log.interceptor';
import { TenantContextService } from '@common/tenant-context.service';
import { TenantInterceptor } from '@common/interceptors/tenant.interceptor';

@Module({
  imports: [
    // CONFIG MODULE (GLOBAL)

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ScheduleModule.forRoot(),

    DatabaseModule,

    AuthModule,
    RegistrationModule,

    AuditLogModule,

    UsersModule,
    CompaniesModule,

    // BUSINESS MODULES

    DashboardModule,
    ProductsModule,
    SuppliersModule,
    TransportsModule,
    VehiclesModule,
    NotificationsModule,
    TasksModule,
    ReferralsModule,
    StockReservationsModule,
    RealtimeModule,
    TutorialsModule,

    // ADMIN & SETTINGS

    SuperadminModule,
    MetricsModule,
    SettingsModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    // GLOBAL GUARDS

    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // GLOBAL FILTERS

    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // GLOBAL INTERCEPTORS

    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },

    // GLOBAL SERVICES

    TenantContextService,
  ],
})
export class AppModule {}
