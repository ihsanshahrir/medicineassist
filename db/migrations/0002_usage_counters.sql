-- M7 hardening: daily counters for tracking usage against Cloudflare's
-- free-tier ceilings (D1 writes, Workers AI Neurons, Queue messages — see
-- the engineering plan's "Free-tier budget sanity check"). Checked manually
-- via `wrangler d1 execute`, not a dashboard — see db/README.md.
CREATE TABLE usage_counters (
  counter_date TEXT NOT NULL,   -- 'YYYY-MM-DD', UTC (SQLite date('now'))
  counter_name TEXT NOT NULL,   -- 'ocr_calls' | 'push_attempts' | 'push_failures'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (counter_date, counter_name)
);
