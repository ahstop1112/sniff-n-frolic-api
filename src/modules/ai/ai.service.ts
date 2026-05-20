import Anthropic from '@anthropic-ai/sdk'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AiService {
  private readonly client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  async generateSeo({ name, shortDescription, description }) {
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `You are an SEO expert for a Vancouver pet store called Sniff & Frolic.
                Generate a meta title (max 60 chars) and meta description (max 160 chars).
                Respond ONLY with valid JSON: {"metaTitle": "...", "metaDescription": "..."}
                No markdown, no explanation.`,
      messages: [{ role: 'user', content: `Product: ${name}...` }],
    })

    const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
      
    const clean = text.replace(/```json\n?|\n?```/g, '').trim()

    return JSON.parse(clean)
  }
}