-- 006_roles.sql
-- Roles and permissions for staff
-- permissions is an array of strings e.g. {'products:read', 'products:write', 'orders:read'}

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link roles to users (staff)
ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN name TEXT;

CREATE INDEX idx_users_role ON users(role_id);

-- Seed default roles
INSERT INTO roles (name, permissions) VALUES
  ('admin',   ARRAY['products:read','products:write','orders:read','orders:write','staff:read','staff:write']),
  ('cashier', ARRAY['products:read','orders:read','orders:write']),
  ('viewer',  ARRAY['products:read','orders:read']);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
