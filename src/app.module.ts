import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from './database/database.module'
import { AuthModule } from './modules/auth/auth.module'
import { ProductsModule } from './modules/products/products.module'
import { OrdersModule } from './modules/orders/orders.module'
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module'
import { ProductsController } from './modules/products/products.controller'
import { AiModule } from './modules/ai/ai.module'
import { InventoryModule } from './modules/inventory/inventory.module'

@Module({
  imports: [DatabaseModule, FeatureFlagsModule, AuthModule, ProductsModule, OrdersModule, AiModule, InventoryModule,],
  controllers: [AppController, ProductsController],
  providers: [AppService],
})
export class AppModule {}
