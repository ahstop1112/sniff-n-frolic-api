import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PoolClient } from 'pg'
import { DatabaseService } from '../../database/database.service'
import { CreateMovementDto } from './dto/create-movement.dto'
import { ListMovementsQuery } from './dto/list-movements.query'
import { ListStockQuery } from './dto/list-stock.query'
import {
  MovementReason,
  USER_SUBMITTABLE_REASONS,
} from './dto/movement-reason.enum'

const DEFAULT_LOW_STOCK_THRESHOLD = 5
const DEFAULT_LIMIT = 50

type StockRow = {
  id: string
  name: string
  sku: string | null
  product_type: string
  stock_quantity: number
  manage_stock: boolean
  stock_status: string | null
  is_low_stock: boolean
  parent_id: string | null
  parent_name: string | null
}

type MovementRow = {
  id: string
  product_id: string
  product_name: string
  product_sku: string | null
  branch_id: string | null
  branch_name: string | null
  quantity_change: number
  reason: string
  reference_id: string | null
  note: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: Date
}

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  // ---------- Stock ----------

  async listStock(query: ListStockQuery) {
    const threshold = query.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD
    const limit = query.limit ?? DEFAULT_LIMIT
    const offset = query.offset ?? 0
    const search = query.search?.trim() || null
    const lowStockOnly = query.low_stock_only === true

    const where: string[] = [`p.product_type IN ('simple', 'variation')`]
    const params: unknown[] = []

    if (search) {
      params.push(`%${search}%`)
      const idx = params.length
      where.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`)
    }

    // Low-stock predicate reused for filter + is_low_stock projection.
    params.push(threshold)
    const thresholdIdx = params.length
    const lowStockExpr = `(p.manage_stock AND p.stock_quantity > 0 AND p.stock_quantity <= $${thresholdIdx})`

    if (lowStockOnly) {
      where.push(lowStockExpr)
    }

    const whereSql = where.join(' AND ')

    const listSql = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.product_type,
        p.stock_quantity,
        p.manage_stock,
        p.stock_status,
        ${lowStockExpr} AS is_low_stock,
        p.parent_id,
        parent.name AS parent_name
      FROM products p
      LEFT JOIN products parent ON parent.id = p.parent_id
      WHERE ${whereSql}
      ORDER BY COALESCE(parent.name, p.name), p.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const listParams = [...params, limit, offset]

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM products p
      WHERE ${whereSql}
    `

    const [listResult, countResult] = await Promise.all([
      this.db.query<StockRow>(listSql, listParams),
      this.db.query<{ total: number }>(countSql, params),
    ])

    return {
      items: listResult.rows,
      total: countResult.rows[0]?.total ?? 0,
      limit,
      offset,
    }
  }

  async getStockByProductId(productId: string, threshold?: number) {
    const thresholdValue = threshold ?? DEFAULT_LOW_STOCK_THRESHOLD
    const result = await this.db.query<StockRow>(
      `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.product_type,
        p.stock_quantity,
        p.manage_stock,
        p.stock_status,
        (p.manage_stock AND p.stock_quantity > 0 AND p.stock_quantity <= $2) AS is_low_stock,
        p.parent_id,
        parent.name AS parent_name
      FROM products p
      LEFT JOIN products parent ON parent.id = p.parent_id
      WHERE p.id = $1
        AND p.product_type IN ('simple', 'variation')
      `,
      [productId, thresholdValue],
    )

    const row = result.rows[0]
    if (!row) {
      throw new NotFoundException(
        `Product "${productId}" not found or not stock-adjustable`,
      )
    }
    return row
  }

  // ---------- Movements ----------

  async listMovements(query: ListMovementsQuery) {
    const limit = query.limit ?? DEFAULT_LIMIT
    const offset = query.offset ?? 0

    if (query.date_from && query.date_to && query.date_from > query.date_to) {
      throw new BadRequestException('date_to must be on or after date_from')
    }

    const where: string[] = []
    const params: unknown[] = []

    if (query.product_id) {
      params.push(query.product_id)
      where.push(`m.product_id = $${params.length}`)
    }
    if (query.branch_id) {
      params.push(query.branch_id)
      where.push(`m.branch_id = $${params.length}`)
    }
    if (query.reason) {
      params.push(query.reason)
      where.push(`m.reason = $${params.length}`)
    }
    if (query.date_from) {
      params.push(query.date_from)
      where.push(`m.created_at >= $${params.length}`)
    }
    if (query.date_to) {
      params.push(query.date_to)
      where.push(`m.created_at <= $${params.length}`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const listSql = `
      SELECT
        m.id,
        m.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        m.branch_id,
        b.name AS branch_name,
        m.quantity_change,
        m.reason,
        m.reference_id,
        m.note,
        m.created_by,
        u.email AS created_by_name,
        m.created_at
      FROM inventory_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN branches b ON b.id = m.branch_id
      LEFT JOIN users u ON u.id = m.created_by
      ${whereSql}
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const listParams = [...params, limit, offset]

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM inventory_movements m
      ${whereSql}
    `

    const [listResult, countResult] = await Promise.all([
      this.db.query<MovementRow>(listSql, listParams),
      this.db.query<{ total: number }>(countSql, params),
    ])

    return {
      items: listResult.rows,
      total: countResult.rows[0]?.total ?? 0,
      limit,
      offset,
    }
  }

  async getMovementById(id: string) {
    const result = await this.db.query<MovementRow>(
      `
      SELECT
        m.id,
        m.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        m.branch_id,
        b.name AS branch_name,
        m.quantity_change,
        m.reason,
        m.reference_id,
        m.note,
        m.created_by,
        u.email AS created_by_name,
        m.created_at
      FROM inventory_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN branches b ON b.id = m.branch_id
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.id = $1
      `,
      [id],
    )

    const row = result.rows[0]
    if (!row) {
      throw new NotFoundException(`Movement "${id}" not found`)
    }
    return row
  }

  // ---------- Adjust ----------

  async createMovement(dto: CreateMovementDto, currentUserId: string) {
    if (!USER_SUBMITTABLE_REASONS.includes(dto.reason)) {
      throw new BadRequestException(
        `Reason "${dto.reason}" is not accepted on this endpoint; sales are recorded by the checkout flow`,
      )
    }

    this.assertReasonDirection(dto.reason, dto.quantity_change)

    return this.db.transaction(async (client) => {
      const product = await this.lockProduct(client, dto.product_id)

      if (!['simple', 'variation'].includes(product.product_type)) {
        throw new NotFoundException(
          `Product "${dto.product_id}" not found or not stock-adjustable`,
        )
      }
      if (!product.manage_stock) {
        throw new BadRequestException(
          'Stock management is not enabled for this product',
        )
      }

      const newQty = product.stock_quantity + dto.quantity_change
      if (newQty < 0) {
        throw new BadRequestException(
          `Insufficient stock: you can deduct at most ${product.stock_quantity}`,
        )
      }

      const insertResult = await client.query<{ id: string; created_at: Date }>(
        `
        INSERT INTO inventory_movements
          (product_id, branch_id, quantity_change, reason, reference_id, note, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at
        `,
        [
          dto.product_id,
          dto.branch_id ?? null,
          dto.quantity_change,
          dto.reason,
          dto.reference_id ?? null,
          dto.note ?? null,
          currentUserId,
        ],
      )
      const movementId = insertResult.rows[0].id

      const newStatus = this.deriveStockStatus(
        product.stock_status,
        product.manage_stock,
        newQty,
      )

      await client.query(
        `UPDATE products
         SET stock_quantity = $1, stock_status = $2, updated_at = NOW()
         WHERE id = $3`,
        [newQty, newStatus, dto.product_id],
      )

      const movementResult = await client.query<MovementRow>(
        `
        SELECT
          m.id,
          m.product_id,
          p.name AS product_name,
          p.sku AS product_sku,
          m.branch_id,
          b.name AS branch_name,
          m.quantity_change,
          m.reason,
          m.reference_id,
          m.note,
          m.created_by,
          u.email AS created_by_name,
          m.created_at
        FROM inventory_movements m
        LEFT JOIN products p ON p.id = m.product_id
        LEFT JOIN branches b ON b.id = m.branch_id
        LEFT JOIN users u ON u.id = m.created_by
        WHERE m.id = $1
        `,
        [movementId],
      )

      return {
        movement: movementResult.rows[0],
        stock_quantity: newQty,
        stock_status: newStatus,
      }
    })
  }

  // ---------- Helpers ----------

  private assertReasonDirection(reason: MovementReason, delta: number) {
    const requiresPositive =
      reason === MovementReason.Restock || reason === MovementReason.Return
    const requiresNegative = reason === MovementReason.Damage

    if (requiresPositive && delta <= 0) {
      throw new BadRequestException(
        `Reason "${reason}" requires a positive quantity_change`,
      )
    }
    if (requiresNegative && delta >= 0) {
      throw new BadRequestException(
        `Reason "${reason}" requires a negative quantity_change`,
      )
    }
  }

  private async lockProduct(client: PoolClient, productId: string) {
    const result = await client.query<{
      id: string
      product_type: string
      stock_quantity: number
      manage_stock: boolean
      stock_status: string | null
    }>(
      `SELECT id, product_type, stock_quantity, manage_stock, stock_status
       FROM products
       WHERE id = $1
       FOR UPDATE`,
      [productId],
    )
    const row = result.rows[0]
    if (!row) {
      throw new NotFoundException(
        `Product "${productId}" not found or not stock-adjustable`,
      )
    }
    return row
  }

  private deriveStockStatus(
    current: string | null,
    manageStock: boolean,
    newQty: number,
  ): string | null {
    if (!manageStock) return current
    if (current === 'onbackorder') return current
    return newQty === 0 ? 'outofstock' : 'instock'
  }
}
