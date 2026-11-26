CREATE TABLE IF NOT EXISTS nibble_app_config (
  config_key text PRIMARY KEY,
  config jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
