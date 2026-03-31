import { Injectable, Logger } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { WooService } from './woo.services';
import { mapWooProductToImportRow } from './products.mapper';

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

    while (true) {
      this.logger.log(`Fetching Woo products page ${page}`);

      const products = await this.wooService.fetchProducts(page, 100);

      if (!products.length) {
        break;
      }

      for (const product of products) {
        const row = mapWooProductToImportRow(product);
        await this.productsRepository.upsertImportedProduct(row);
      }

      totalImported += products.length;
      this.logger.log(`Imported page ${page}: ${products.length} products`);

      page += 1;
    }

    this.logger.log(`Import complete. Total imported: ${totalImported}`);

    return {
      success: true,
      totalImported,
    };
  };
}