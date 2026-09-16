import { Module } from '@nestjs/common';
import { TransportsService } from '../modules/transports/transports.service';
import { TransportsController } from '../modules/transports/controllers/transports.controller';
import { TransportRepository } from '../database/repositories/transport.repository';
import { PrismaService } from '../database/prisma.service';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { StockReservationsModule } from '../modules/stock-reservations/stock-reservations.module';
import { RealtimeModule } from '../modules/realtime/realtime.module';

@Module({
  imports: [NotificationsModule, StockReservationsModule, RealtimeModule],
  controllers: [TransportsController],
  providers: [TransportsService, TransportRepository, PrismaService],
  exports: [TransportsService],
})
export class TransportsModule {}
