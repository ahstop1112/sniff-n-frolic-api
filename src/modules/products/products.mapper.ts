import { ProductImportRow, WooProduct } from './products.types';

const toCents = (value?: string | null): number | null => {
  if (!value || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
};

export const mapWooProductToImportRow = (
  product: WooProduct,
): ProductImportRow => {
  const regularPrice = toCents(product.regular_price) ?? 0;
  const salePrice = toCents(product.sale_price);
  const effectivePrice = salePrice ?? toCents(product.price) ?? regularPrice;

  return {
    wooProductId: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.short_description?.trim() || null,
    description: product.description?.trim() || null,
    sku: product.sku?.trim() || null,
    productType: product.type || 'simple',
    status: product.status || 'draft',
    featured: Boolean(product.featured),
    regularPrice,
    salePrice,
    effectivePrice,
    currency: 'CAD',
    stockStatus: product.stock_status || null,
    stockQuantity: product.stock_quantity ?? 0,
    manageStock: Boolean(product.manage_stock),
    featuredImageUrl: product.images?.[0]?.src || null,
    wooCreatedAt: product.date_created ? new Date(product.date_created) : null,
    wooUpdatedAt: product.date_modified ? new Date(product.date_modified) : null,
    syncSource: 'woocommerce',
  };
};