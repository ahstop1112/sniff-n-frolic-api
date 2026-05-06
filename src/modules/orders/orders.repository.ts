import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { Order, OrderItem } from './orders.types'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { CreatePOSOrderDto } from './dto/create-pos-order.dto'

@Injectable()
export class OrdersRepository {
  public constructor(private readonly databaseService: DatabaseService) {}

  public createOrder = async (dto: CreateOrderDto): Promise<Order> => {
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    )

    return this.databaseService.transaction(async (client) => {
      const orderRes = await client.query<Order>(
        `INSERT INTO orders
          (source, status, subtotal, total, currency, guest_name, guest_email, shipping_address, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          'online',
          'pending',
          subtotal,
          subtotal,
          dto.currency ?? 'CAD',
          dto.guest_name,
          dto.guest_email,
          JSON.stringify(dto.shipping_address),
          dto.notes ?? null,
        ],
      )

      const order = orderRes.rows[0]

      for (const item of dto.items) {
        await client.query(
          `INSERT INTO order_items
            (order_id, product_id, product_name, sku, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            order.id,
            item.product_id,
            item.product_name,
            item.sku ?? null,
            item.quantity,
            item.unit_price,
            item.unit_price * item.quantity,
          ],
        )
      }

      return order
    })
  }

  public createPOSOrder = async (dto: CreatePOSOrderDto): Promise<Order> => {
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity, 0
    )

    return this.databaseService.transaction(async (client) => {
      const orderRes = await client.query<Order>(
        `INSERT INTO orders
          (source, status, subtotal, total, currency, staff_id, notes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          'pos',
          'completed',       // POS 落單即係完成
          subtotal,
          subtotal,
          dto.currency ?? 'CAD',
          dto.staff_id,
          dto.notes ?? null,
          JSON.stringify({
            payment_method: dto.payment_method,
            amount_tendered: dto.amount_tendered,
            change: Math.max(0, dto.amount_tendered - subtotal),
          }),
        ]
      )

      const order = orderRes.rows[0]

      for (const item of dto.items) {
        await client.query(
          `INSERT INTO order_items
            (order_id, product_id, product_name, sku, quantity, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            order.id, item.product_id, item.product_name,
            item.sku ?? null, item.quantity, item.unit_price,
            item.unit_price * item.quantity,
          ]
        )
      }

      return order
    })
  }

  public getDailySummary = async () => {
    const revenueRes = await this.databaseService.query<{
      total_revenue: string
      order_count: string
      item_count: string
    }>(
      `SELECT
        COALESCE(SUM(o.total), 0)        AS total_revenue,
        COUNT(DISTINCT o.id)             AS order_count,
        COALESCE(SUM(oi.quantity), 0)    AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.source = 'pos'
         AND o.status = 'completed'
         AND o.created_at >= CURRENT_DATE`,
      []
    )

    const topItemsRes = await this.databaseService.query<{
      product_name: string
      qty: string
      total: string
    }>(
      `SELECT
        oi.product_name,
        SUM(oi.quantity)              AS qty,
        SUM(oi.subtotal)              AS total
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.source = 'pos'
         AND o.status = 'completed'
         AND o.created_at >= CURRENT_DATE
       GROUP BY oi.product_name
       ORDER BY qty DESC
       LIMIT 10`,
      []
    )

    const row = revenueRes.rows[0]

    return {
      totalRevenue: Number(row.total_revenue),
      orderCount:   Number(row.order_count),
      itemCount:    Number(row.item_count),
      topItems: topItemsRes.rows.map((r) => ({
        name:  r.product_name,
        qty:   Number(r.qty),
        total: Number(r.total),
      })),
    }
  }

  public findById = async (id: string): Promise<Order | null> => {
    const result = await this.databaseService.query<Order>(
      `SELECT * FROM orders WHERE id = $1`,
      [id],
    )
    return result.rows[0] ?? null
  }

  public findItemsByOrderId = async (orderId: string): Promise<OrderItem[]> => {
    const result = await this.databaseService.query<OrderItem>(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId],
    )
    return result.rows
  }
}