import { Controller, Get, Post, Put, Body, Param, NotFoundException } from '@nestjs/common'
import { ProductsRepository } from '../products/products.repository'
import { CategoriesImporter } from './categories.importer'

@Controller('categories')
export class CategoriesController {
  public constructor(
    private readonly categoriesImporter: CategoriesImporter,
    private readonly productsRepository: ProductsRepository,
  ) {}

  @Get()
  public async getCategories() {
    return this.productsRepository.findAllCategories()
  }

  @Get(':slug')
  public async getCategoryBySlug(@Param('slug') slug: string) {
    const category = await this.productsRepository.findCategoryBySlug(slug)
    if (!category) throw new NotFoundException(`Category "${slug}" not found`)
    return category
  }

  @Post()
  public async createCategory(@Body() body: { name: string }) {
    return this.productsRepository.createCategory(body.name)
  }

  @Put(':id')
  public async updateCategory(
    @Param('id') id: string,
    @Body() body: { name: string },
  ) {
    const updated = await this.productsRepository.updateCategory(id, body.name)
    if (!updated) throw new NotFoundException(`Category "${id}" not found`)
    return updated
  }

  @Post('import/woocommerce')
  public async importFromWooCommerce() {
    return this.categoriesImporter.importAll()
  }
}