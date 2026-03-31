CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO branches (code, name)
VALUES
  ('vancouver', 'Vancouver'),
  ('richmond', 'Richmond'),
  ('burnaby', 'Burnaby'),
  ('newWest', 'New Westminster'),
  ('coquitlam', 'Coquitlam');