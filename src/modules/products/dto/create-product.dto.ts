export interface CreateProductDto {
    name: string
    slug?: string                 // auto-generate if empty
    category_id?: string | null
    short_description?: string | null
    description?: string | null
    regular_price: number         // cents
    sale_price?: number | null
    stock_quantity?: number
    stock_status?: "instock" | "outofstock"
    status?: "published" | "draft" | "archived"
    featured_image_url?: string | null
    meta_title?: string | null
    meta_description?: string | null
}