export type WooProductImage = {
  id?: number;
  src: string;
  alt?: string;
};

export type WooProductCategory = {
  id: number;
  name: string;
  slug: string;
};

export type WooCategory = {
  id: number;
  name: string;
  slug: string;
  parent: number;  // 0 = top-level
};

export type WooProduct = {
  id: number;
  slug: string;
  name: string;
  short_description?: string;
  description?: string;
  sku?: string;
  type?: string;
  status?: string;
  featured?: boolean;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_status?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  images?: WooProductImage[];
  date_created?: string;
  date_modified?: string;
  categories?: WooProductCategory[];
};

export type ProductImportRow = {
  wooProductId: number;
  categoryId: string | null;       // UUID from product_categories
  categoryIds: string[]; 
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  sku: string | null;
  productType: string;
  status: string;
  featured: boolean;
  regularPrice: number;
  salePrice: number | null;
  currency: string;
  stockStatus: string | null;
  stockQuantity: number;
  manageStock: boolean;
  featuredImageUrl: string | null;
  images: { url: string; altText: string | null; sortOrder: number; isFeatured: boolean }[];
  wooCreatedAt: Date | null;
  wooUpdatedAt: Date | null;
};