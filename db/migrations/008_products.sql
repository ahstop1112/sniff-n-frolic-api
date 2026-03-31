-- 008_products.sql
-- All prices stored in cents (integer)
-- e.g. $10.99 CAD → 1099

CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Core
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  sku               TEXT,
  short_description TEXT,
  description       TEXT,
  product_type      TEXT NOT NULL DEFAULT 'simple',
  status            TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  featured          BOOL NOT NULL DEFAULT false,

  -- Pricing in cents
  regular_price     INT NOT NULL DEFAULT 0,
  sale_price        INT,
  effective_price   INT GENERATED ALWAYS AS (
                      COALESCE(sale_price, regular_price)
                    ) STORED,
  currency          TEXT NOT NULL DEFAULT 'CAD',

  -- Inventory
  stock_status      TEXT,  -- instock | outofstock | onbackorder
  stock_quantity    INT NOT NULL DEFAULT 0,
  manage_stock      BOOL NOT NULL DEFAULT false,

  -- Featured image (quick access; full gallery in product_images)
  featured_image_url TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug     ON products(slug);
CREATE INDEX idx_products_sku      ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_products_status   ON products(status);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Product images gallery
CREATE TABLE product_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt_text    TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_featured BOOL NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);
