-- MedsAssist v1 schema.
-- See /Users/ihsan/.claude/plans (or the commit history) for the full design
-- rationale — this file is deliberately just the SQL, kept lean to review.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL DEFAULT 'en',        -- 'en' | 'ms'
  text_size TEXT NOT NULL DEFAULT 'normal',   -- 'normal'|'large'|'xl'
  timezone TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  tz_offset_minutes INTEGER NOT NULL DEFAULT 480,
  quiet_hours_start_local TEXT,
  quiet_hours_end_local TEXT,
  quiet_hours_start_utc TEXT,
  quiet_hours_end_utc TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE medicines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  strength TEXT,
  form TEXT NOT NULL DEFAULT 'tablet',        -- tablet|capsule|syrup|inhaler|drops|other
  what_for TEXT,
  instructions_text TEXT,
  instruction_tags TEXT NOT NULL DEFAULT '[]', -- JSON: with_food|before_food|empty_stomach|swallow_whole|do_not_crush|shake_first
  warning_tags TEXT NOT NULL DEFAULT '[]',     -- JSON: drowsiness|no_alcohol|do_not_drive|keep_refrigerated
  notes TEXT,
  accent_index INTEGER NOT NULL DEFAULT 1,     -- 1-8, round-robin at creation
  pill_photo_key TEXT,                         -- R2 key
  label_photo_key TEXT,                        -- R2 key
  ocr_source TEXT,                             -- JSON: raw extraction + per-field confidence (audit trail)
  supply_count REAL,                           -- nullable = not tracked
  supply_alert_7d_sent INTEGER NOT NULL DEFAULT 0,
  supply_alert_2d_sent INTEGER NOT NULL DEFAULT 0,
  last_refill_at TEXT,
  last_refill_amount REAL,
  is_draft INTEGER NOT NULL DEFAULT 1,         -- 1 while mid Add-Medicine flow, 0 once "Done"
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_medicines_user ON medicines(user_id) WHERE is_archived = 0;

CREATE TABLE schedules ( -- 1:1 with medicine — v1: no PRN, no tapering
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL UNIQUE REFERENCES medicines(id) ON DELETE CASCADE,
  dose_amount REAL NOT NULL,                   -- supports 0.5 (half tablet)
  dose_unit TEXT NOT NULL,                     -- tablet|capsule|half_tablet|ml|puff|drop
  repeat_type TEXT NOT NULL,                   -- daily|every_n_days|weekdays
  repeat_interval_days INTEGER,                -- used iff repeat_type='every_n_days'
  weekdays_mask INTEGER,                       -- used iff repeat_type='weekdays'; bit0=Mon..bit6=Sun
  start_date TEXT NOT NULL,                    -- 'YYYY-MM-DD', local
  end_date TEXT,                                -- nullable
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE schedule_times (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  time_local TEXT NOT NULL,                    -- 'HH:MM', for display/edit
  time_utc TEXT NOT NULL,                      -- 'HH:MM', precomputed from time_local + user offset (no DST in SEA)
  anchor_label TEXT                            -- morning|afternoon|evening|night|custom, nullable
);
CREATE INDEX idx_schedule_times_utc ON schedule_times(time_utc); -- cron's hot index

CREATE TABLE dose_logs ( -- one row per actioned/fired dose instance (not pre-materialized)
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  scheduled_at TEXT NOT NULL,                  -- ISO UTC datetime for this specific occurrence
  status TEXT NOT NULL DEFAULT 'pending',      -- pending|taken|skipped|snoozed|missed
  dose_amount REAL NOT NULL,                   -- snapshot at fire time
  dose_unit TEXT NOT NULL,
  taken_at TEXT,
  snooze_count INTEGER NOT NULL DEFAULT 0,     -- max 2
  snoozed_until TEXT,
  last_push_sent_at TEXT,
  followup_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(medicine_id, scheduled_at)
);
CREATE INDEX idx_dose_logs_user_date ON dose_logs(user_id, scheduled_at);
CREATE INDEX idx_dose_logs_status_sched ON dose_logs(status, scheduled_at); -- cron sweeps

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  installed_as_pwa INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
