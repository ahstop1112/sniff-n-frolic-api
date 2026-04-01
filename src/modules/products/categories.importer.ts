import { Injectable, Logger } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { WooService } from './woo.services';
import { WooCategory } from './products.types';

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

@Injectable()
export class CategoriesImporter {
  private readonly logger = new Logger(CategoriesImporter.name);

  public constructor(
    private readonly wooService: WooService,
    private readonly productsRepository: ProductsRepository,
  ) {}

  public importAll = async () => {
    let page = 1;
    let totalImported = 0;

    const allCategories: WooCategory[] = [];

    while (true) {
      this.logger.log(`Fetching Woo categories page ${page}`);
      const categories = await this.wooService.fetchCategories(page, 100);
      if (!categories.length) break;
      allCategories.push(...categories);
      page += 1;
    }

    // Build wooId → slug map for parent resolution
    const wooIdToSlug = new Map<number, string>();
    for (const c of allCategories) {
      wooIdToSlug.set(c.id, c.slug);
    }

    // Upsert top-level first, then children
    const topLevel = allCategories.filter((c) => c.parent === `0`);
    const children = allCategories.filter((c) => c.parent !== `0`);

    for (const c of [...topLevel, ...children]) {
      const parentSlug = c.parent !== `0` ? (wooIdToSlug.get(Number(c.parent)) ?? null) : null;

      await this.productsRepository.upsertCategoryWithParent({
        name: decodeHtmlEntities(c.name),
        slug: c.slug,
        parentSlug,
        imageUrl: c.image?.src ?? null,
      });

      totalImported += 1;
    }

    this.logger.log(`Category import complete. Total: ${totalImported}`);
    return { success: true, totalImported };
  };
}