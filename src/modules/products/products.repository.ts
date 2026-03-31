import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ProductImportRow } from './products.types';

@Injectable()
export class ProductsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public upsertCategory = async (wooCategory: {
    name: string;
    slug: string;
  }): Promise<string> => {
    const result = await this.databaseService.query(
      `
      INSERT INTO product_categories (name, slug)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET
        name       = EXCLUDED.name,
        updated_at = NOW()
      RETURNING id
      `,
      [wooCategory.name, wooCategory.slug],
    );
    return result.rows[0].id as string;
  };

  public upsertCategoryWithParent = async (cat: {
    name: string;
    slug: string;
    parentSlug: string | null;
  }): Promise<string> => {
    const result = await this.databaseService.query(
      `
      INSERT INTO product_categories (name, slug, parent_id)
      VALUES (
        $1,
        $2,
        (SELECT id FROM product_categories WHERE slug = $3)
      )
      ON CONFLICT (slug) DO UPDATE SET
        name       = EXCLUDED.name,
        parent_id  = EXCLUDED.parent_id,
        updated_at = NOW()
      RETURNING id
      `,
      [cat.name, cat.slug, cat.parentSlug],
    );
    return result.rows[0].id as string;
  };

  public upsertImportedProduct = async (row: ProductImportRow) => {
    const result = await this.databaseService.query(
      `
      INSERT INTO products (
        woo_product_id,
        category_id,
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
        currency,
        stock_status,
        stock_quantity,
        manage_stock,
        featured_image_url,
        woo_created_at,
        woo_updated_at,
        synced_at,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, NOW(), NOW(), NOW()
      )
      ON CONFLICT (woo_product_id) DO UPDATE SET
        category_id        = EXCLUDED.category_id,
        slug               = EXCLUDED.slug,
        name               = EXCLUDED.name,
        short_description  = EXCLUDED.short_description,
        description        = EXCLUDED.description,
        sku                = EXCLUDED.sku,
        product_type       = EXCLUDED.product_type,
        status             = EXCLUDED.status,
        featured           = EXCLUDED.featured,
        regular_price      = EXCLUDED.regular_price,
        sale_price         = EXCLUDED.sale_price,
        currency           = EXCLUDED.currency,
        stock_status       = EXCLUDED.stock_status,
        stock_quantity     = EXCLUDED.stock_quantity,
        manage_stock       = EXCLUDED.manage_stock,
        featured_image_url = EXCLUDED.featured_image_url,
        woo_created_at     = EXCLUDED.woo_created_at,
        woo_updated_at     = EXCLUDED.woo_updated_at,
        synced_at          = NOW(),
        updated_at         = NOW()
      RETURNING id, slug, name
      `,
      [
        row.wooProductId,
        row.categoryId,
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
        row.currency,
        row.stockStatus,
        row.stockQuantity,
        row.manageStock,
        row.featuredImageUrl,
        row.wooCreatedAt,
        row.wooUpdatedAt,
      ],
    );

    const product = result.rows[0];

    // Sync product_category_map
    if (row.categoryIds.length > 0) {
      await this.databaseService.query(
        `DELETE FROM product_category_map WHERE product_id = $1`,
        [product.id],
      );
      for (const categoryId of row.categoryIds) {
        await this.databaseService.query(
          `
          INSERT INTO product_category_map (product_id, category_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [product.id, categoryId],
        );
      }
    }

    // Sync images
    if (row.images.length > 0) {
      await this.databaseService.query(
        `DELETE FROM product_images WHERE product_id = $1`,
        [product.id],
      );
      for (const img of row.images) {
        await this.databaseService.query(
          `
          INSERT INTO product_images (product_id, url, alt_text, sort_order, is_featured)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [product.id, img.url, img.altText, img.sortOrder, img.isFeatured],
        );
      }
    }

    return product;
  };

  public findAll = async ({
    page,
    limit,
    categorySlug,
    search,
    status = 'published',
  }: {
    page: number;
    limit: number;
    categorySlug?: string;
    search?: string;
    status?: string;
  }) => {
    const offset = (page - 1) * limit;
    const params: any[] = [limit, offset, status];
    const conditions: string[] = ['p.status = $3'];

    // Use product_category_map for category filter (supports multiple categories)
    if (categorySlug) {
      params.push(categorySlug);
      conditions.push(`
        EXISTS (
          SELECT 1 FROM product_category_map pcm
          JOIN product_categories pc ON pc.id = pcm.category_id
          WHERE pcm.product_id = p.id AND pc.slug = $${params.length}
        )
      `);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`p.name ILIKE $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await this.databaseService.query(
      `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.short_description,
        p.regular_price,
        p.sale_price,
        p.effective_price,
        p.currency,
        p.featured_image_url,
        p.status,
        p.stock_status,
        p.featured,
        pc.id   AS category_id,
        pc.name AS category_name,
        pc.slug AS category_slug,
        (
          SELECT json_agg(
            json_build_object(
              'url', pi.url,
              'alt_text', pi.alt_text,
              'sort_order', pi.sort_order,
              'is_featured', pi.is_featured
            ) ORDER BY pi.sort_order
          )
          FROM product_images pi
          WHERE pi.product_id = p.id
        ) AS images
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
      `,
      params,
    );

    return result.rows;
  };

  public findBySlug = async (slug: string) => {
    const result = await this.databaseService.query(
      `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.short_description,
        p.description,
        p.sku,
        p.product_type,
        p.regular_price,
        p.sale_price,
        p.effective_price,
        p.currency,
        p.featured_image_url,
        p.status,
        p.stock_status,
        p.stock_quantity,
        p.manage_stock,
        p.featured,
        pc.id   AS category_id,
        pc.name AS category_name,
        pc.slug AS category_slug,
        (
          SELECT json_agg(
            json_build_object(
              'url', pi.url,
              'alt_text', pi.alt_text,
              'sort_order', pi.sort_order,
              'is_featured', pi.is_featured
            ) ORDER BY pi.sort_order
          )
          FROM product_images pi
          WHERE pi.product_id = p.id
        ) AS images
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE p.slug = $1
        AND p.status = 'published'
      `,
      [slug],
    );

    return result.rows[0] ?? null;
  };

  public findAllCategories = async () => {
    const result = await this.databaseService.query(
      `
      SELECT
        pc.id,
        pc.name,
        pc.slug,
        pc.description,
        pc.parent_id,
        parent.slug AS parent_slug,
        COUNT(DISTINCT pcm.product_id)::int AS count
      FROM product_categories pc
      LEFT JOIN product_categories parent ON parent.id = pc.parent_id
      LEFT JOIN product_category_map pcm ON pcm.category_id = pc.id
      LEFT JOIN products p ON p.id = pcm.product_id AND p.status = 'published'
      GROUP BY pc.id, parent.slug
      ORDER BY pc.sort_order ASC, pc.name ASC
      `,
    );

    return result.rows;
  };

  public findCategoryBySlug = async (slug: string) => {
    const result = await this.databaseService.query(
      `
      SELECT id, name, slug, description, parent_id
      FROM product_categories
      WHERE slug = $1
      `,
      [slug],
    );

    return result.rows[0] ?? null;
  };
}