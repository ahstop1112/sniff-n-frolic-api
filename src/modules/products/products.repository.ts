import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { ProductImportRow } from './products.types'
import type { UpdateProductDto } from './dto/update-product.dto'
import type { CreateProductDto } from './dto/create-product.dto'

@Injectable()
export class ProductsRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public upsertCategory = async (wooCategory: {
    name: string
    slug: string
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
    )
    return result.rows[0].id as string
  }

  public upsertCategoryWithParent = async (cat: {
    name: string
    slug: string
    parentSlug: string | null
    imageUrl: string | null
  }): Promise<string> => {
    const result = await this.databaseService.query(
      `
      INSERT INTO product_categories (name, slug, parent_id, image_url)
      VALUES (
        $1,
        $2,
        (SELECT id FROM product_categories WHERE slug = $3),
        $4
      )
      ON CONFLICT (slug) DO UPDATE SET
        name       = EXCLUDED.name,
        parent_id  = EXCLUDED.parent_id,
        image_url  = EXCLUDED.image_url,
        updated_at = NOW()
      RETURNING id
      `,
      [cat.name, cat.slug, cat.parentSlug, cat.imageUrl],
    )
    return result.rows[0].id as string
  }

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
    )

    const product = result.rows[0]

    // Sync product_category_map
    if (row.categoryIds.length > 0) {
      await this.databaseService.query(
        `DELETE FROM product_category_map WHERE product_id = $1`,
        [product.id],
      )
      for (const categoryId of row.categoryIds) {
        await this.databaseService.query(
          `
          INSERT INTO product_category_map (product_id, category_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [product.id, categoryId],
        )
      }
    }

    // Sync images
    if (row.images.length > 0) {
      await this.databaseService.query(
        `DELETE FROM product_images WHERE product_id = $1`,
        [product.id],
      )
      for (const img of row.images) {
        await this.databaseService.query(
          `
          INSERT INTO product_images (product_id, url, alt_text, sort_order, is_featured)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [product.id, img.url, img.altText, img.sortOrder, img.isFeatured],
        )
      }
    }

    return product
  }

  public findAll = async ({
    page,
    limit,
    categorySlug,
    search,
    status = 'published',
  }: {
    page: number
    limit: number
    categorySlug?: string
    search?: string
    status?: string
  }) => {
    const offset = (page - 1) * limit
    const params: any[] = [limit, offset, status]
    const conditions: string[] = ['p.status = $3', "p.product_type != 'variation'"]

    if (categorySlug) {
      params.push(categorySlug)
      conditions.push(`
        EXISTS (
          SELECT 1 FROM product_category_map pcm
          JOIN product_categories pc ON pc.id = pcm.category_id
          WHERE pcm.product_id = p.id AND pc.slug = $${params.length}
        )
      `)
    }

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`p.name ILIKE $${params.length}`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`

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
        p.product_type,
        p.featured,
        pc.id        AS category_id,
        pc.name      AS category_name,
        pc.slug      AS category_slug,
        pc.image_url AS category_image_url,
        (
          SELECT MIN(v.effective_price)
          FROM products v
          WHERE v.product_type = 'variation'
            AND v.slug LIKE p.slug || '-%'
            AND v.status = 'published'
        ) AS min_variation_price,
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
    )

    return result.rows
  }

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
        ) AS images,
        (
          SELECT json_agg(
            json_build_object(
              'id', v.id,
              'slug', v.slug,
              'name', v.name,
              'sku', v.sku,
              'regular_price', v.regular_price,
              'sale_price', v.sale_price,
              'effective_price', v.effective_price,
              'stock_status', v.stock_status,
              'stock_quantity', v.stock_quantity,
              'featured_image_url', v.featured_image_url,
              'attributes', (
                SELECT json_agg(
                  json_build_object(
                    'name', va.name,
                    'slug', va.slug,
                    'option', va.option_value
                  )
                )
                FROM product_variation_attributes va
                WHERE va.variation_id = v.id
              )
            )
          )
          FROM products v
          WHERE v.slug LIKE p.slug || '-%'
            AND v.product_type = 'variation'
            AND v.status = 'published'
        ) AS variations,
        (
          SELECT MIN(v.effective_price)
          FROM products v
          WHERE v.product_type = 'variation'
            AND v.slug LIKE p.slug || '-%'
            AND v.status = 'published'
        ) AS min_variation_price
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE p.slug = $1
        AND p.status = 'published'
      `,
      [slug],
    )
  
    return result.rows[0] ?? null
  }

  public upsertVariationAttributes = async (
    variationId: string,
    attributes: { name: string; slug: string; optionValue: string }[],
  ): Promise<void> => {
    await this.databaseService.query(
      `DELETE FROM product_variation_attributes WHERE variation_id = $1`,
      [variationId],
    )
    for (const attr of attributes) {
      await this.databaseService.query(
        `INSERT INTO product_variation_attributes (variation_id, name, slug, option_value)
         VALUES ($1, $2, $3, $4)`,
        [variationId, attr.name, attr.slug, attr.optionValue],
      )
    }
  }

  public findAllCategories = async () => {
    const result = await this.databaseService.query(
      `
      SELECT
        pc.id,
        pc.name,
        pc.slug,
        pc.description,
        pc.image_url,
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
    )

    return result.rows
  }

  public findCategoryBySlug = async (slug: string) => {
    const result = await this.databaseService.query(
      `
      SELECT id, name, slug, description, image_url, parent_id
      FROM product_categories
      WHERE slug = $1
      `,
      [slug],
    )

    return result.rows[0] ?? null
  }

  public findForManage = async ({
    page,
    limit,
    search,
  }: {
    page: number
    limit: number
    search?: string
  }) => {
    const offset = (page - 1) * limit
    const params: any[] = [limit, offset]
    const conditions: string[] = ["p.product_type != 'variation'"]
  
    if (search) {
      params.push(`%${search}%`)
      conditions.push(`p.name ILIKE $${params.length}`)
    }
  
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  
    const result = await this.databaseService.query(
      `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.sku,
        p.product_type,
        p.status,
        p.regular_price,
        p.sale_price,
        p.effective_price,
        p.stock_status,
        p.stock_quantity,
        p.featured_image_url,
        p.updated_at,
        pc.name AS category_name
      FROM products p
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      ${where}
      ORDER BY p.updated_at DESC
      LIMIT $1 OFFSET $2
      `,
      params,
    )
  
    return result.rows
  }
  
  public updateProduct = async (id: string, dto: UpdateProductDto) => {
    const fields: string[] = []
    const values: any[] = []
    let idx = 1
  
    if (dto.name !== undefined)               { fields.push(`name = $${idx++}`);                values.push(dto.name) }
    if (dto.slug !== undefined)               { fields.push(`slug = $${idx++}`);                values.push(dto.slug) }
    if (dto.short_description !== undefined)  { fields.push(`short_description = $${idx++}`);   values.push(dto.short_description) }
    if (dto.description !== undefined)        { fields.push(`description = $${idx++}`);         values.push(dto.description) }
    if (dto.regular_price !== undefined)      { fields.push(`regular_price = $${idx++}`);       values.push(dto.regular_price) }
    if (dto.sale_price !== undefined)         { fields.push(`sale_price = $${idx++}`);          values.push(dto.sale_price) }
    if (dto.stock_quantity !== undefined)     { fields.push(`stock_quantity = $${idx++}`);      values.push(dto.stock_quantity) }
    if (dto.stock_status !== undefined)       { fields.push(`stock_status = $${idx++}`);        values.push(dto.stock_status) }
    if (dto.status !== undefined)             { fields.push(`status = $${idx++}`);              values.push(dto.status) }
    if (dto.featured_image_url !== undefined) { fields.push(`featured_image_url = $${idx++}`); values.push(dto.featured_image_url) }
    if (dto.meta_title !== undefined)         { fields.push(`meta_title = $${idx++}`);          values.push(dto.meta_title) }
    if (dto.meta_description !== undefined)   { fields.push(`meta_description = $${idx++}`);   values.push(dto.meta_description) }
  
    if (fields.length === 0) return null
  
    fields.push(`updated_at = NOW()`)
    values.push(id)
  
    const result = await this.databaseService.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    )
  
    return result.rows[0] ?? null
  }
  
  public createProduct = async (dto: CreateProductDto) => {
    // Auto-generate slug from name if not provided
    const slug = dto.slug?.trim() || dto.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
  
    const result = await this.databaseService.query(
      `
      INSERT INTO products (
        name, slug, category_id, short_description, description,
        regular_price, sale_price, stock_quantity, stock_status,
        status, featured_image_url, meta_title, meta_description,
        product_type, currency, manage_stock
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'simple','CAD',false)
      RETURNING *
      `,
      [
        dto.name,
        slug,
        dto.category_id ?? null,
        dto.short_description ?? null,
        dto.description ?? null,
        dto.regular_price,
        dto.sale_price ?? null,
        dto.stock_quantity ?? 0,
        dto.stock_status ?? 'instock',
        dto.status ?? 'draft',
        dto.featured_image_url ?? null,
        dto.meta_title ?? null,
        dto.meta_description ?? null,
      ]
    )
  
    return result.rows[0]
  }

  public updateProductImages = async (
    productId: string,
    images: { url: string; alt_text: string | null; sort_order: number; is_featured: boolean }[]
  ) => {
    await this.databaseService.query(
      `DELETE FROM product_images WHERE product_id = $1`,
      [productId]
    )

    for (const img of images) {
      await this.databaseService.query(
        `INSERT INTO product_images (product_id, url, alt_text, sort_order, is_featured)
        VALUES ($1, $2, $3, $4, $5)`,
        [productId, img.url, img.alt_text, img.sort_order, img.is_featured]
      )
    }
  }
} 