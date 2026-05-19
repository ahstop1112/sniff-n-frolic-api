import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { Order, OrderItem } from './orders.types'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { CreatePOSOrderDto } from './dto/create-pos-order.dto'

@Injectable()
export class OrdersRepository {
  public constructor(private readonly databaseService: DatabaseService) { }
  
  // Next JS storefront order creation flow
  public createOrder = async (dto: CreateOrderDto): Promise<Order> => {
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    )

    return this.databaseService.transaction(async (client) => {
      const orderRes = await client.query<Order>(
        `INSERT INTO orders
          (source, status, subtotal, shipping, tax, total, currency, guest_name, guest_email, shipping_address, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          'online',
          'pending',
          subtotal,
          dto.shipping,  // $4
          dto.tax,       // $5
          dto.total,
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

  public completeOrder = async (
    id: string,
    paymentIntentId: string,
  ): Promise<Order | null> => {
    const result = await this.databaseService.query<Order>(
      `UPDATE orders
      SET status = 'processing',
          metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        JSON.stringify({
          payment_intent_id: paymentIntentId,
          paid_at: new Date().toISOString(),
          paid_via: 'stripe_nextjs',
        }),
      ],
    )
    return result.rows[0] ?? null
  }

  // POS storefront order creation flow
  public createPOSOrder = async (dto: CreatePOSOrderDto): Promise<Order> => {
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity, 0
    )

    return this.databaseService.transaction(async (client) => {
      const orderRes = await client.query<Order>(
        `INSERT INTO orders
          (source, status, subtotal, total, currency, branch_id, staff_id, notes, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          'pos',
          'completed',
          subtotal,
          subtotal,
          dto.currency ?? 'CAD',
          dto.branch_id,      // $6
          dto.staff_id,       // $7
          dto.notes ?? null,  // $8
          JSON.stringify({    // $9
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

  public getDailySummary = async (branchId: string) => {
    const revenueRes = await this.databaseService.query<{
      total_revenue: string
      order_count: string
      item_count: string
    }>(
      `SELECT
        COALESCE(SUM(o.total), 0)     AS total_revenue,
        COUNT(DISTINCT o.id)          AS order_count,
        COALESCE(SUM(oi.quantity), 0) AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       JOIN branches b ON b.id = $1
       WHERE o.source = 'pos'
         AND o.status = 'completed'
         AND o.branch_id = $1
         AND o.created_at >= (CURRENT_DATE AT TIME ZONE b.timezone)`,
      [branchId]
    )

    const ordersRes = await this.databaseService.query<{
      order_id: string
      created_at: string
      order_total: string
      item_count: string
      items: { name: string; qty: number; total: number }[]
    }>(
      `SELECT
        o.id          AS order_id,
        o.created_at,
        o.total       AS order_total,
        COUNT(oi.id)  AS item_count,
        json_agg(
          json_build_object(
            'name',  oi.product_name,
            'qty',   oi.quantity,
            'total', oi.subtotal
          ) ORDER BY oi.created_at
        ) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN branches b ON b.id = $1
       WHERE o.source = 'pos'
         AND o.status = 'completed'
         AND o.branch_id = $1
         AND o.created_at >= (CURRENT_DATE AT TIME ZONE b.timezone)
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [branchId]
    )  
  
    const row = revenueRes.rows[0]
  
    return {
      totalRevenue: Number(row.total_revenue),
      orderCount:   Number(row.order_count),
      itemCount:    Number(row.item_count),
      orders: ordersRes.rows.map((o, i) => ({
        label:     `Order ${i + 1}`,
        id:        o.order_id,
        createdAt: o.created_at,
        total:     Number(o.order_total),
        itemCount: Number(o.item_count),
        items:     o.items,
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

  public findAllBranches = async () => {
    const result = await this.databaseService.query(
      `SELECT id, code, name, timezone FROM branches WHERE status = 'active' ORDER BY name`,
      []
    )
    return result.rows
  }


}