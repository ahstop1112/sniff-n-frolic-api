import { Injectable, Logger } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { WooService } from './woo.services';
import { mapWooProductToImportRow } from './products.mapper';

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

@Injectable()
export class ProductsImporter {
  private readonly logger = new Logger(ProductsImporter.name);

  public constructor(
    private readonly wooService: WooService,
    private readonly productsRepository: ProductsRepository,
  ) {}

  public importAll = async () => {
    let page = 1;
    let totalImported = 0;

    // Cache category slug → UUID to avoid duplicate DB calls
    const categoryCache = new Map<string, string>();

    const resolveCategoryId = async (slug: string, name: string): Promise<string> => {
      if (categoryCache.has(slug)) return categoryCache.get(slug)!;
      const id = await this.productsRepository.upsertCategory({
        name: decodeHtmlEntities(name),
        slug,
      });
      categoryCache.set(slug, id);
      return id;
    };

    while (true) {
      this.logger.log(`Fetching Woo products page ${page}`);

      const products = await this.wooService.fetchProducts(page, 100);
      if (!products.length) break;

      for (const product of products) {
        const categories = product.categories ?? [];

        // Resolve all category UUIDs
        const categoryIds: string[] = [];
        for (const cat of categories) {
          const id = await resolveCategoryId(cat.slug, cat.name);
          categoryIds.push(id);
        }

        // First category = primary
        const categoryId = categoryIds[0] ?? null;

        const row = mapWooProductToImportRow(product, categoryId, categoryIds);
        await this.productsRepository.upsertImportedProduct(row);
      }

      totalImported += products.length;
      this.logger.log(`Imported page ${page}: ${products.length} products`);
      page += 1;
    }

    this.logger.log(`Import complete. Total imported: ${totalImported}`);
    return { success: true, totalImported };
  };
}