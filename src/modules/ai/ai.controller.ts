import { Controller, Post, Body, UseGuards } from '@nestjs/common'
import { AiService } from './ai.service'

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-seo')
  async generateSeo(
    @Body() body: { name: string; shortDescription: string; description: string },
  ) {
    return this.aiService.generateSeo(body)
  }
}