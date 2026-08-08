-- 017_inventory_prep.sql
-- Prep for the inventory API:
--   1. Variation-parent link on products (needed for the Stock Overview grouping).
--   2. Reason CHECK on inventory_movements (aligns DB with app-layer enum).
--   3. Non-negative stock guard on products.stock_quantity (belt-and-suspenders).

BEGIN;

-- 1. Variation parent link.
--    Simple products: parent_id NULL, product_type = 'simple'
--    Variable parents: parent_id NULL, product_type = 'variable'
--    Variations:       parent_id = <parent uuid>, product_type = 'variation'
ALTER TABLE products
  ADD COLUMN parent_id UUID REFERENCES products(id) ON DELETE CASCADE;

CREATE INDEX idx_products_parent
  ON products(parent_id)
  WHERE parent_id IS NOT NULL;

-- 2. Reason enum. Matches the app-layer MovementReason enum.
ALTER TABLE inventory_movements
  ADD CONSTRAINT chk_inventory_movements_reason
  CHECK (reason IN ('sale', 'restock', 'adjustment', 'return', 'damage'));

-- 3. Non-negative stock guard. If this fails, run:
--      SELECT id, name, stock_quantity FROM products WHERE stock_quantity < 0;
--    and reconcile before re-applying the migration.
ALTER TABLE products
  ADD CONSTRAINT chk_products_stock_quantity_non_negative
  CHECK (stock_quantity >= 0);

COMMIT;
