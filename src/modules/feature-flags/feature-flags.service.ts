import { Injectable } from '@nestjs/common';
import { FeatureFlagsRepository } from './feature-flags.repository';
import type { FeatureFlagKey, FeatureFlagRecord } from './feature-flags.types';

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly featureFlagsRepository: FeatureFlagsRepository,
  ) {}

  public async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const flag = await this.featureFlagsRepository.findByKey(key);

    if (!flag) {
      return false;
    }

    return flag.enabled;
  }

  public async getFlag(
    key: FeatureFlagKey,
  ): Promise<FeatureFlagRecord | null> {
    return this.featureFlagsRepository.findByKey(key);
  }

  public async getAllFlags(): Promise<FeatureFlagRecord[]> {
    return this.featureFlagsRepository.findAll();
  }

  public async assertEnabled(key: FeatureFlagKey): Promise<void> {
    const enabled = await this.isEnabled(key);

    if (!enabled) {
      throw new Error(`Feature flag "${key}" is disabled.`);
    }
  }
}