import { Controller, Query, Get, Post } from '@nestjs/common';
import { ProductsImporter } from './products.importer';
import { ProductsRepository } from './products.repository';

@Controller('products')
export class ProductsController {
    public constructor(
        private readonly productsImporter: ProductsImporter,
        private readonly productsRepository: ProductsRepository
    ) { }

    @Post('import/woocommerce')
        public async importFromWooCommerce(){
        return this.productsImporter.importAll();
    };
    
    @Get()
    public async getProducts(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
    return this.productsRepository.findAll({
        page: Number(page),
        limit: Number(limit),
    });
    }
}