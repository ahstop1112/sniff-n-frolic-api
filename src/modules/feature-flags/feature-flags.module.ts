import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsRepository, FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}