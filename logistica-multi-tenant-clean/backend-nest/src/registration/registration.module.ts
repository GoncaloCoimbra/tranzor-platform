import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RegistrationController } from './controllers/registration.controller';
import { RegistrationService } from './registration.service';
import { DatabaseModule } from '../database/database.module';
import { getJwtSecret } from '../config/jwt-secret';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
