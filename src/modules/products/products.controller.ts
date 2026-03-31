import { Controller, Query, Get, Post, Param, NotFoundException } from '@nestjs/common';
import { ProductsImporter } from './products.importer';
import { ProductsRepository } from './products.repository';

@Controller('products')
export class ProductsController {
    public constructor(
        private readonly productsImporter: ProductsImporter,
        private readonly productsRepository: ProductsRepository
    ) { }

    // GET  /products                          → list (支援 ?category=slug&search=xxx&page=1&limit=20)
    @Get()
    public async getProducts(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('category') categorySlug?: string,
        @Query('search') search?: string,
    ) {
        return this.productsRepository.findAll({
        page: Number(page),
        limit: Number(limit),
        categorySlug,
        search,
        });
    }

    // GET  /products/:slug                    → single product
    @Get(':slug')
    public async getProductBySlug(@Param('slug') slug: string) {
        const product = await this.productsRepository.findBySlug(slug);
        if (!product) throw new NotFoundException(`Product "${slug}" not found`);
        return product;
    }
    
    // GET  /products/categories/:slug         → single category
    @Get('categories/:slug')
    public async getCategoryBySlug(@Param('slug') slug: string) {
        const category = await this.productsRepository.findCategoryBySlug(slug);
        if (!category) throw new NotFoundException(`Category "${slug}" not found`);
        return category;
    }
    // POST /products/import/woocommerce       → woo sync
    @Post('import/woocommerce')
        public async importFromWooCommerce(){
        return this.productsImporter.importAll();
    };
}