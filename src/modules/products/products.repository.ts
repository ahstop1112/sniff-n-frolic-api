import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProductImportRow } from './products.types';

@Injectable()
export class ProductsRepository {
    public constructor(private readonly databaseService: DatabaseService) { }

    public upsertImportedProduct = async (row: ProductImportRow) => {
        const query = `
        INSERT INTO products (
        woo_product_id,
        slug,
        name,
        short_description,
        description,
        sku,
        product_type,
        status,
        featured,
        regular_price,
        sale_price,
        effective_price,
        currency,
        stock_status,
        stock_quantity,
        manage_stock,
        featured_image_url,
        sync_source,
        woo_created_at,
        woo_updated_at,
        synced_at,
        created_at,
        updated_at
        )
        VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, NOW(), NOW(), NOW()
        )
        ON CONFLICT (woo_product_id)
        DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        short_description = EXCLUDED.short_description,
        description = EXCLUDED.description,
        sku = EXCLUDED.sku,
        product_type = EXCLUDED.product_type,
        status = EXCLUDED.status,
        featured = EXCLUDED.featured,
        regular_price = EXCLUDED.regular_price,
        sale_price = EXCLUDED.sale_price,
        effective_price = EXCLUDED.effective_price,
        currency = EXCLUDED.currency,
        stock_status = EXCLUDED.stock_status,
        stock_quantity = EXCLUDED.stock_quantity,
        manage_stock = EXCLUDED.manage_stock,
        featured_image_url = EXCLUDED.featured_image_url,
        sync_source = EXCLUDED.sync_source,
        woo_created_at = EXCLUDED.woo_created_at,
        woo_updated_at = EXCLUDED.woo_updated_at,
        synced_at = NOW(),
        updated_at = NOW()
        RETURNING id, woo_product_id, name
    `;

        return this.databaseService.query(query, [
            row.wooProductId,
            row.slug,
            row.name,
            row.shortDescription,
            row.description,
            row.sku,
            row.productType,
            row.status,
            row.featured,
            row.regularPrice,
            row.salePrice,
            row.effectivePrice,
            row.currency,
            row.stockStatus,
            row.stockQuantity,
            row.manageStock,
            row.featuredImageUrl,
            row.syncSource,
            row.wooCreatedAt,
            row.wooUpdatedAt,
        ]);
    };
    
    public findAll = async ({
        page,
        limit,
    }: {
        page: number;
        limit: number;
    }) => {
        const offset = (page - 1) * limit;
        const result = await this.databaseService.query(
            `SELECT 
                id,
                name,
                slug,
                regular_price,
                sale_price,
                featured_image_url
            FROM products
            ORDER BY woo_product_id DESC
            LIMIT $1 OFFSET $2
            `,
            [limit, offset]
        );

        return result.rows;
    }
}