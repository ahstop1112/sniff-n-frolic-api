import { Controller, Get } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  @Get()
  public async getAllFlags() {
    const flags = await this.featureFlagsService.getAllFlags();

    return {
      ok: true,
      flags: flags.map((flag) => ({
        key: flag.key,
        enabled: flag.enabled,
        description: flag.description,
        updatedAt: flag.updated_at,
      })),
    };
  }
}