import type { CreateOrderItemDto } from './create-order.dto'

export interface CreatePOSOrderDto {
    branch_id: string 
    staff_id: string
    items: CreateOrderItemDto[]
    currency?: string
    notes?: string
    payment_method: "cash" | "credit" | "debit"
    amount_tendered: number   // cents
}