import type { ShippingAddress } from '../orders.types'

export interface CreateOrderItemDto {
  product_id: string
  product_name: string
  sku?: string
  quantity: number
  unit_price: number // cents
}

export interface CreateOrderDto {
  guest_name: string
  guest_email: string
  shipping_address: ShippingAddress
  items: CreateOrderItemDto[]
  notes?: string
  currency?: string
}