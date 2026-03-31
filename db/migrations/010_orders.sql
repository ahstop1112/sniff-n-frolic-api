-- 010_orders.sql
-- Single orders table serving both POS + online store
-- source column distinguishes channel: 'pos' | 'online'
-- metadata JSONB holds channel-specific fields:
--   POS:    { "terminal_id": "POS-01", "payment_method": "cash" }
--   Online: { "shipping_address": "...", "payment_ref": "stripe_xxx" }

CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  member_id   UUID REFERENCES members(id) ON DELETE SET NULL,  -- nullable (guest checkout)
  staff_id    UUID REFERENCES users(id) ON DELETE SET NULL,    -- nullable (online has no staff)

  -- Channel
  source      TEXT NOT NULL,  -- 'pos' | 'online'
  status      TEXT NOT NULL DEFAULT 'pending',
                              -- pending | confirmed | processing | completed | cancelled | refunded

  -- Totals in cents
  subtotal    INT NOT NULL DEFAULT 0,
  discount    INT NOT NULL DEFAULT 0,
  total       INT NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'CAD',

  -- Channel-specific fields
  metadata    JSONB NOT NULL DEFAULT '{}',

  -- Notes
  notes       TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_member   ON orders(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX idx_orders_staff    ON orders(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_orders_source   ON orders(source);
CREATE INDEX idx_orders_status   ON orders(status);
CREATE INDEX idx_orders_created  ON orders(created_at DESC);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Order line items
-- unit_price stored at time of order (snapshot) — never FK to current product price
CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,  -- nullable if product deleted

  -- Snapshot of product at time of order
  product_name TEXT NOT NULL,
  sku          TEXT,
  quantity     INT NOT NULL DEFAULT 1,
  unit_price   INT NOT NULL,   -- cents, locked at order time
  subtotal     INT NOT NULL,   -- unit_price * quantity

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id) WHERE product_id IS NOT NULL;
