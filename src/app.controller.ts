import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  public getHello(): string {
    return this.appService.getHello();
  };

  @Get('health')
  public async health() {
    const result = await this.databaseService.query<{ now: Date }>(
      'SELECT NOW() AS now',
    );

    return {
      ok: true,
      message: this.appService.getHello(),
      dbTime: result.rows[0]?.now,
    };
  };
}