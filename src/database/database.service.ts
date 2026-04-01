import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    this.logger.log(`NODE_ENV: ${process.env.NODE_ENV ?? 'undefined'}`);
    this.logger.log(`PORT: ${process.env.PORT ?? 'undefined'}`);
    this.logger.log(`DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    this.logger.log(`ENV keys count: ${Object.keys(process.env).length}`);

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined');
    }

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    try {
      return await this.pool.query<T>(text, params);
    } catch (error) {
      this.logger.error('Database query failed');
      this.logger.error(text);
      this.logger.error(error);

      throw error;
    }
  }

  // ✅ transaction support（超重要）
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction failed');
      this.logger.error(error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async onModuleDestroy() {
    await this.pool.end();
  }
}