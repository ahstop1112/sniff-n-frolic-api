import {
  Controller,
  Query,
  Get,
  Post,
  Put,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ProductsImporter } from './products.importer';
import { ProductsRepository } from './products.repository';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
  public constructor(
    private readonly productsImporter: ProductsImporter,
    private readonly productsRepository: ProductsRepository,
  ) {}

  // GET /products
  @Get()
  public async getProducts(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('category') categorySlug?: string,
    @Query('search') search?: string,
    @Query('brand') brandSlug?: string,
    @Query('on_sale') onSale?: string,
    @Query('sort') sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc',
  ) {
    return this.productsRepository.findAll({
      page: Number(page),
      limit: Number(limit),
      categorySlug,
      search,
      brandSlug,
      onSale: onSale === 'true',
      sort,
    });
  }

  // GET /products/manage
  @Get('manage')
  public async getProductsForManage(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.productsRepository.findForManage({
      page: Number(page),
      limit: Number(limit),
      search,
    });
  }

  // POST /products
  @Post()
  public async createProduct(@Body() dto: CreateProductDto) {
    return this.productsRepository.createProduct(dto);
  }

  // PUT /products/:id
  @Put(':id')
  public async updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const updated = await this.productsRepository.updateProduct(id, dto);
    if (!updated) throw new NotFoundException(`Product "${id}" not found`);
    return updated;
  }

  @Put(':id/images')
  public async updateProductImages(
    @Param('id') id: string,
    @Body() body: { images: any[] },
  ) {
    await this.productsRepository.updateProductImages(id, body.images);
    return { success: true };
  }

  // GET /products/categories/:slug
  @Get('categories/:slug')
  public async getCategoryBySlug(@Param('slug') slug: string) {
    const category = await this.productsRepository.findCategoryBySlug(slug);
    if (!category) throw new NotFoundException(`Category "${slug}" not found`);
    return category;
  }

  // GET /products/:slug
  @Get(':slug')
  public async getProductBySlug(
    @Param('slug') slug: string,
    @Query('manage') manage?: string,
  ) {
    const product = await this.productsRepository.findBySlug(
      slug,
      manage === 'true',
    );
    if (!product) throw new NotFoundException(`Product "${slug}" not found`);
    return product;
  }

  // POST /products/import/woocommerce
  @Post('import/woocommerce')
  public async importFromWooCommerce() {
    return this.productsImporter.importAll();
  }
}
