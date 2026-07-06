-- 016_inventory_movements.sql

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
  quantity_change integer NOT NULL,
  reason text NOT NULL,  -- 'sale', 'restock', 'adjustment', 'return'
  reference_id uuid,     -- order_id 或其他來源
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_branch ON inventory_movements(branch_id);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at);