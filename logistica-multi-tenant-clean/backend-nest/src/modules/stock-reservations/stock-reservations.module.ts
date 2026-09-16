import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { RedisLockService } from './redis-lock.service';
import { StockReservationsService } from './stock-reservations.service';
import { StockReservationsController } from './stock-reservations.controller';

@Module({
  imports: [RealtimeModule],
  controllers: [StockReservationsController],
  providers: [RedisLockService, StockReservationsService],
  exports: [StockReservationsService],
})
export class StockReservationsModule {}
