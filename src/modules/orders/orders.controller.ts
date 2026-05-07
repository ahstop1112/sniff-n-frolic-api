import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common'
import { OrdersService } from './orders.service'
import type { CreateOrderDto } from './dto/create-order.dto'
import type { CreatePOSOrderDto } from './dto/create-pos-order.dto'

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.service.createOrder(dto)
  }

  @Post('pos')
  createPOS(@Body() dto: CreatePOSOrderDto) {
    return this.service.createPOSOrder(dto)
  }

  @Get('summary/today')
  getDailySummary(@Query('branchId') branchId: string) {
    return this.service.getDailySummary(branchId)
  }

  @Get('branches')
  getBranches() {
    return this.service.getBranches()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.getOrder(id)
  }
}