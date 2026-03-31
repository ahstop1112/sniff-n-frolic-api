CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO feature_flags (id, key, description, enabled)
VALUES
  (gen_random_uuid(), 'auth_enabled', 'Enable authentication flow', TRUE),
  (gen_random_uuid(), 'email_otp_login', 'Enable Email OTP login', TRUE),
  (gen_random_uuid(), 'sales_enabled', 'Enable sales screen', TRUE)
ON CONFLICT (key) DO NOTHING;