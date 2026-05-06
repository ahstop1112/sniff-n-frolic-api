import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { DatabaseService } from '../../database/database.service';

@Module({
    controllers: [OrdersController],
    providers: [OrdersService, OrdersRepository, DatabaseService],
})
export class OrdersModule {}