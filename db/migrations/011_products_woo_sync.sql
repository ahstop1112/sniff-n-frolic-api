-- 011_products_woo_sync.sql
ALTER TABLE products
  ADD COLUMN woo_product_id  INT UNIQUE,
  ADD COLUMN woo_created_at  TIMESTAMPTZ,
  ADD COLUMN woo_updated_at  TIMESTAMPTZ,
  ADD COLUMN synced_at       TIMESTAMPTZ;

CREATE INDEX idx_products_woo_id ON products(woo_product_id) WHERE woo_product_id IS NOT NULL;
