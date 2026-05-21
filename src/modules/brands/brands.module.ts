import { Module } from '@nestjs/common'
import { BrandsController } from './brands.controller'
import { BrandsRepository } from './brands.repository'
import { DatabaseService } from '../../database/database.service'

@Module({
  controllers: [BrandsController],
  providers: [BrandsRepository, DatabaseService     ],
  exports: [BrandsRepository],
})
export class BrandsModule {}