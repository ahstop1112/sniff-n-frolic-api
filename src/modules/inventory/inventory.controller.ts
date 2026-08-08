import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { CurrentUser } from '../auth/auth.decorators'
import { AuthGuard } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.types'
import { CreateMovementDto } from './dto/create-movement.dto'
import { ListMovementsQuery } from './dto/list-movements.query'
import { ListStockQuery } from './dto/list-stock.query'
import { InventoryService } from './inventory.service'

@Controller('inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  async listStock(@Query() query: ListStockQuery) {
    return this.inventoryService.listStock(query)
  }

  @Get('stock/:productId')
  async getStock(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Query('low_stock_threshold') threshold?: string,
  ) {
    const parsedThreshold =
      threshold === undefined ? undefined : Number(threshold)
    return this.inventoryService.getStockByProductId(productId, parsedThreshold)
  }

  @Get('movements')
  async listMovements(@Query() query: ListMovementsQuery) {
    return this.inventoryService.listMovements(query)
  }

  @Get('movements/:id')
  async getMovement(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.inventoryService.getMovementById(id)
  }

  @Post('movements')
  @HttpCode(201)
  async createMovement(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user')
    }
    return this.inventoryService.createMovement(dto, user.id)
  }
}
