import Anthropic from '@anthropic-ai/sdk'
import { Injectable } from '@nestjs/common'

@Injectable()
export class AiService {
  private readonly client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  async generateSeo({ name, shortDescription, description, brands }: {
        name: any
        shortDescription?: any
        description?: any
        brands?: string[]
  }) {
        const brandStr = brands?.length ? brands[0] : 'Sniff & Frolic'
        const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are an SEO copywriter specializing in pet e-commerce, writing in the style of Yoast SEO best practices.
            Generate a meta title and meta description for a product from Sniff & Frolic — a Vancouver-based pet lifestyle store.
            Meta title rules:
            - Max 60 characters
            - Format MUST be: "{Product Name} – ${brandStr}"
            - If no brand provided, use "Sniff & Frolic" as fallback
            - Use an em dash (–), not a hyphen (-)
            - Natural, not keyword-stuffed
            
            Meta description rules:
            - Max 160 characters
            - Action-oriented, include a benefit or CTA (e.g. "Shop now", "Free local delivery")
            - Include 1-2 natural keywords
            - Sound human, not AI-generated
            Respond ONLY with raw JSON, no markdown, no code fences:
            {"metaTitle": "...", "metaDescription": "..."}`,
        messages: [{
            role: 'user',
            content: `Product: ${name}
            Short description: ${shortDescription || 'N/A'}
            Description: ${description || 'N/A'}`
        }],
    })

        const text = response.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('')
      
        const clean = text.replace(/```json\n?|\n?```/g, '').trim()

        return JSON.parse(clean)
  }
}