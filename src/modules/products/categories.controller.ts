import { Controller, Get, Post, Param, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from '../products/products.repository';
import { CategoriesImporter } from './categories.importer';
 
@Controller('categories')
export class CategoriesController {
  public constructor(
    private readonly categoriesImporter: CategoriesImporter,
    private readonly productsRepository: ProductsRepository,
  ) { }
    
    @Post('import/woocommerce')
        public async importFromWooCommerce() {
        return this.categoriesImporter.importAll();
    }
 
    @Get()
    public async getCategories() {
        return this.productsRepository.findAllCategories();
    }
 
    @Get(':slug')
    public async getCategoryBySlug(@Param('slug') slug: string) {
        const category = await this.productsRepository.findCategoryBySlug(slug);
        if (!category) throw new NotFoundException(`Category "${slug}" not found`);
        return category;
    }
}