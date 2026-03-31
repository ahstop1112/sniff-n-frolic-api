import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WooProduct } from './products.types';

@Injectable()
export class WooService {
  public constructor(private readonly configService: ConfigService) {}

  public fetchProducts = async (
    page: number,
    perPage = 100,
  ): Promise<WooProduct[]> => {
    const baseUrl = this.configService.get<string>('WOO_API_BASE_URL');
    const consumerKey = this.configService.get<string>('WOO_CONSUMER_KEY');
    const consumerSecret = this.configService.get<string>('WOO_CONSUMER_SECRET');

    if (!baseUrl) {
      throw new Error('Missing WOO_API_BASE_URL');
    }

    if (!consumerKey) {
      throw new Error('Missing WOO_CONSUMER_KEY');
    }

    if (!consumerSecret) {
      throw new Error('Missing WOO_CONSUMER_SECRET');
    }

   const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const url = new URL(`${normalizedBaseUrl}/products`);

    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    url.searchParams.set('consumer_key', consumerKey);
    url.searchParams.set('consumer_secret', consumerSecret);
    url.searchParams.set('status', 'any');

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Woo fetch failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
      
    // return url.toString();

    return (await response.json()) as WooProduct[];
  };
}