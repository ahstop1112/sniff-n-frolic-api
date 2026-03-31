import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { FeatureFlagRecord } from './feature-flags.types';

@Injectable()
export class FeatureFlagsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  public async findByKey(key: string): Promise<FeatureFlagRecord | null> {
    const query = `
      SELECT
        key,
        enabled,
        description,
        updated_at
      FROM feature_flags
      WHERE key = $1
      LIMIT 1
    `;

    const result = await this.databaseService.query<FeatureFlagRecord>(query, [
      key,
    ]);

    return result.rows[0] ?? null;
  }

  public async findAll(): Promise<FeatureFlagRecord[]> {
    const query = `
      SELECT
        key,
        enabled,
        description,
        updated_at
      FROM feature_flags
      ORDER BY key ASC
    `;

    const result =
      await this.databaseService.query<FeatureFlagRecord>(query);

    return result.rows;
  }
}