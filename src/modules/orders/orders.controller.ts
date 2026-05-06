import { Controller, Post, Get, Param, Body } from '@nestjs/common'
import { OrdersService } from './orders.service'
import type { CreateOrderDto } from './dto/create-order.dto'

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.service.createOrder(dto)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.getOrder(id)
  }
}