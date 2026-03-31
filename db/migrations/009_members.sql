-- 009_members.sql
-- Customer / membership accounts
-- Separate from staff (users table)

CREATE TABLE members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name            TEXT,
  email           TEXT UNIQUE,
  phone           TEXT UNIQUE,
  password_hash   TEXT,

  -- Membership
  membership_tier TEXT NOT NULL DEFAULT 'standard', -- standard | silver | gold | vip
  points          INT NOT NULL DEFAULT 0,
  is_active       BOOL NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_email ON members(email) WHERE email IS NOT NULL;
CREATE INDEX idx_members_phone ON members(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_members_tier  ON members(membership_tier);

CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
