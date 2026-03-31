import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductsController } from './products.controller';
import { ProductsImporter } from './products.importer';
import { ProductsRepository } from './products.repository';
import { DatabaseService } from '../../database/database.service';
import { WooService } from './woo.services';

@Module({
  imports: [ConfigModule],
  controllers: [ProductsController],
  providers: [ProductsImporter, ProductsRepository, DatabaseService, WooService],
  exports: [ProductsImporter, ProductsRepository],
})
export class ProductsModule {}