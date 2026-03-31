import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { ProductsController } from './modules/products/products.controller';

@Module({
  imports: [DatabaseModule, FeatureFlagsModule, AuthModule, ProductsModule],
  controllers: [AppController, ProductsController],
  providers: [AppService],
})
export class AppModule {}