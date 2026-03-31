import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProductsController } from './products.controller';
import { CategoriesController } from './categories.controller';
import { CategoriesImporter } from './categories.importer';
import { ProductsImporter } from './products.importer';
import { ProductsRepository } from './products.repository';
import { DatabaseService } from '../../database/database.service';
import { WooService } from './woo.services';

@Module({
  imports: [ConfigModule],
controllers: [ProductsController, CategoriesController],
  providers: [ProductsImporter, CategoriesImporter, ProductsRepository, DatabaseService, WooService],
  exports: [ProductsImporter, CategoriesImporter, ProductsRepository],
})
export class ProductsModule {}