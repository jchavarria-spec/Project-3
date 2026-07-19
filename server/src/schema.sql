CREATE TABLE IF NOT EXISTS businesses (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  phone         TEXT DEFAULT '',
  email         TEXT DEFAULT '',
  address       TEXT DEFAULT '',
  logo_url      TEXT DEFAULT '',
  timezone      TEXT DEFAULT 'America/New_York',
  booking_intro TEXT DEFAULT 'Request an appointment below and we''ll confirm shortly.',
  open_time     TEXT DEFAULT '08:00',
  close_time    TEXT DEFAULT '18:00',
  google_review_url      TEXT DEFAULT '',
  yelp_review_url        TEXT DEFAULT '',
  sms_reminders_enabled  BOOLEAN DEFAULT TRUE,
  email_reminders_enabled BOOLEAN DEFAULT TRUE,
  review_requests_enabled BOOLEAN DEFAULT TRUE,
  reminder_hours_before  INTEGER DEFAULT 24,
  plan          TEXT DEFAULT 'trial',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'tech', -- 'owner' | 'tech'
  color         TEXT DEFAULT '#2563eb',
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);

CREATE TABLE IF NOT EXISTS services (
  id           SERIAL PRIMARY KEY,
  business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT DEFAULT '',
  duration_min INTEGER NOT NULL DEFAULT 60,
  price_cents  INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN DEFAULT TRUE,
  sort         INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);

CREATE TABLE IF NOT EXISTS jobs (
  id             SERIAL PRIMARY KEY,
  business_id    INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id     INTEGER REFERENCES services(id) ON DELETE SET NULL,
  technician_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | completed | cancelled
  scheduled_at   TIMESTAMPTZ NOT NULL,
  duration_min   INTEGER NOT NULL DEFAULT 60,
  address        TEXT DEFAULT '',
  notes          TEXT DEFAULT '',
  price_cents    INTEGER DEFAULT 0,
  source         TEXT DEFAULT 'manual', -- manual | online
  reminder_sent  BOOLEAN DEFAULT FALSE,
  review_request_sent BOOLEAN DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_business_time ON jobs(business_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);

CREATE TABLE IF NOT EXISTS messages_log (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_id      INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL,          -- 'sms' | 'email'
  type        TEXT NOT NULL,          -- 'confirmation' | 'reminder' | 'review_request'
  recipient   TEXT DEFAULT '',
  status      TEXT NOT NULL,          -- 'sent' | 'skipped' | 'failed'
  detail      TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_business ON messages_log(business_id, created_at);
