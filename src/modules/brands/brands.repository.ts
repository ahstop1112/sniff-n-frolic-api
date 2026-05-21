import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'

@Injectable()
export class BrandsRepository {
    constructor(private readonly db: DatabaseService) {}

    public findAll = async () => {
        const result = await this.db.query(
        `SELECT id, name, slug, website_url, logo_url
        FROM brands
        ORDER BY name ASC`
        )
        return result.rows
    }

    public findById = async (id: string) => {
        const result = await this.db.query(
            `SELECT id, name, slug FROM brands WHERE id = $1`,
            [id]
        )
        return result.rows[0] ?? null
    }

    public create = async (name: string) => {
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')

        const result = await this.db.query(
            `INSERT INTO brands (name, slug)
            VALUES ($1, $2)
            ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
            RETURNING id, name, slug`,
            [name, slug],
        )
        return result.rows[0]
    }

    public update = async (id: string, name: string) => {
        const result = await this.db.query(
        `UPDATE brands SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, slug`,
        [name, id]
        )
        return result.rows[0] ?? null
    }

    public syncBrandMap = async (productId: string, brandIds: string[]): Promise<void> => {
        await this.db.query(
        `DELETE FROM product_brand_map WHERE product_id = $1`,
        [productId]
        )
        for (const brandId of brandIds) {
        await this.db.query(
            `INSERT INTO product_brand_map (product_id, brand_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [productId, brandId]
        )
        }
    }
}