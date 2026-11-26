CREATE TABLE IF NOT EXISTS nibble_site_visit_days (
  visit_date date PRIMARY KEY,
  page_views bigint NOT NULL DEFAULT 0,
  unique_browsers bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nibble_site_browser_days (
  visit_date date NOT NULL,
  browser_hash text NOT NULL,
  PRIMARY KEY (visit_date, browser_hash)
);

CREATE INDEX IF NOT EXISTS nibble_site_browser_days_hash_date_idx
  ON nibble_site_browser_days (browser_hash, visit_date);
