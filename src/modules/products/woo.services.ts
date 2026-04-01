import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WooProduct, WooCategory } from './products.types';

@Injectable()
export class WooService {
  public constructor(private readonly configService: ConfigService) {}

  private getWooEnv = () => {
    const baseUrl = this.configService.get<string>('WOO_API_BASE_URL');
    const consumerKey = this.configService.get<string>('WOO_CONSUMER_KEY');
    const consumerSecret = this.configService.get<string>('WOO_CONSUMER_SECRET');

    if (!baseUrl) throw new Error('Missing WOO_API_BASE_URL');
    if (!consumerKey) throw new Error('Missing WOO_CONSUMER_KEY');
    if (!consumerSecret) throw new Error('Missing WOO_CONSUMER_SECRET');

    return {
      baseUrl: baseUrl.replace(/\/$/, ''),
      consumerKey,
      consumerSecret,
    };
  };

  private buildUrl = (path: string): URL => {
    const { baseUrl, consumerKey, consumerSecret } = this.getWooEnv();
    const url = new URL(`${baseUrl}/${path}`);
    url.searchParams.set('consumer_key', consumerKey);
    url.searchParams.set('consumer_secret', consumerSecret);
    return url;
  };

  private wooFetch = async <T>(url: URL): Promise<T> => {
    const response = await fetch(url.toString());
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Woo fetch failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    return response.json() as Promise<T>;
  };

  public fetchProducts = async (
    page: number,
    perPage = 100,
  ): Promise<WooProduct[]> => {
    const url = this.buildUrl('products');
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    url.searchParams.set('status', 'any');
    url.searchParams.set(
      '_fields',
      'id,slug,name,short_description,description,sku,type,status,featured,price,regular_price,sale_price,stock_status,stock_quantity,manage_stock,images,date_created,date_modified,categories',
    );
    return this.wooFetch<WooProduct[]>(url);
  };

  public fetchCategories = async (
    page: number,
    perPage = 100,
  ): Promise<WooCategory[]> => {
    const url = this.buildUrl('products/categories');
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    url.searchParams.set('_fields', 'id,name,slug,parent,image');
    return this.wooFetch<WooCategory[]>(url);
  };
}