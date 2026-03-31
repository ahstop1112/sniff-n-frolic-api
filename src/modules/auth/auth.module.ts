import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule, FeatureFlagsModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, AuthGuard],
  exports: [AuthService],
})
export class AuthModule {}