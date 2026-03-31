import { ProductImportRow, WooProduct } from './products.types';

const toCents = (value?: string | null): number | null => {
  if (!value || value.trim() === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100);
};

const mapStatus = (status?: string): string => {
  if (status === 'publish') return 'published';
  if (status === 'trash') return 'archived';
  return status || 'draft';
};

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

export const mapWooProductToImportRow = (
  product: WooProduct,
  categoryId: string | null,
  categoryIds: string[] = [],
): ProductImportRow => {
  const regularPrice = toCents(product.regular_price) ?? 0;
  const salePrice = toCents(product.sale_price);

  return {
    wooProductId: product.id,
    categoryId,
    categoryIds,
    slug: product.slug,
    name: decodeHtmlEntities(product.name),
    shortDescription: product.short_description?.trim() || null,
    description: product.description?.trim() || null,
    sku: product.sku?.trim() || null,
    productType: product.type || 'simple',
    status: mapStatus(product.status),
    featured: Boolean(product.featured),
    regularPrice,
    salePrice,
    currency: 'CAD',
    stockStatus: product.stock_status || null,
    stockQuantity: product.stock_quantity ?? 0,
    manageStock: Boolean(product.manage_stock),
    featuredImageUrl: product.images?.[0]?.src || null,
    images: (product.images ?? []).map((img, i) => ({
      url: img.src,
      altText: img.alt?.trim() || null,
      sortOrder: i,
      isFeatured: i === 0,
    })),
    wooCreatedAt: product.date_created ? new Date(product.date_created) : null,
    wooUpdatedAt: product.date_modified ? new Date(product.date_modified) : null,
  };
};