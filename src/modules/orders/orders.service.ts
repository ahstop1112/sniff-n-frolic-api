import { Injectable, NotFoundException } from '@nestjs/common'
import { OrdersRepository } from './orders.repository'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { CreatePOSOrderDto } from './dto/create-pos-order.dto'

@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersRepository) {}

  async createOrder(dto: CreateOrderDto) {
    return this.repo.createOrder(dto)
  }

  async createPOSOrder(dto: CreatePOSOrderDto) {
    return this.repo.createPOSOrder(dto)
  }

  async getOrder(id: string) {
    const order = await this.repo.findById(id)
    if (!order) throw new NotFoundException(`Order ${id} not found`)
    const items = await this.repo.findItemsByOrderId(id)
    return { ...order, items }
  }

  async getDailySummary(branchId: string) {
    return this.repo.getDailySummary(branchId)
  }

  async getBranches() {
    return this.repo.findAllBranches()
  }

  async completeOrder(id: string, paymentIntentId: string) {
    const order = await this.repo.findById(id)
    if (!order) throw new NotFoundException(`Order ${id} not found`)

    if (['processing', 'completed'].includes(order.status)) {
      return { ok: true, order, alreadyCompleted: true }
    }

    const updated = await this.repo.findById(id)
    const items = await this.repo.findItemsByOrderId(id)
    return { ok: true, order: { ...updated, items } }
  }
}