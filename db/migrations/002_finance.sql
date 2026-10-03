-- Migration: 002_finance
-- Description: Organization-scoped monthly budgets, expenses, and import provenance (FEAT-006)
-- Forward-only and additive: no existing table or column is altered or dropped.

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  source_filename TEXT NOT NULL,
  content_digest TEXT NOT NULL,
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  imported_count INTEGER NOT NULL CHECK (imported_count >= 0),
  skipped_duplicate_count INTEGER NOT NULL CHECK (skipped_duplicate_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_org ON import_batches (organization_id, created_at);

-- Amounts are integer centavos in PHP, capped at PHP 999,999,999.99.
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  category TEXT NOT NULL CHECK (category = BTRIM(category) AND CHAR_LENGTH(category) BETWEEN 1 AND 60),
  amount_centavos BIGINT NOT NULL CHECK (amount_centavos > 0 AND amount_centavos <= 99999999999),
  currency TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_org_month_category
  ON budgets (organization_id, month, LOWER(category));

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  amount_centavos BIGINT NOT NULL CHECK (amount_centavos > 0 AND amount_centavos <= 99999999999),
  currency TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
  category TEXT NOT NULL CHECK (category = BTRIM(category) AND CHAR_LENGTH(category) BETWEEN 1 AND 60),
  description TEXT NOT NULL CHECK (CHAR_LENGTH(description) BETWEEN 1 AND 500),
  vendor TEXT CHECK (vendor IS NULL OR CHAR_LENGTH(vendor) BETWEEN 1 AND 120),
  reference TEXT CHECK (reference IS NULL OR CHAR_LENGTH(reference) BETWEEN 1 AND 120),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  import_batch_id TEXT REFERENCES import_batches(id),
  source_row INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  voided_at TIMESTAMPTZ,
  voided_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_expenses_import_provenance CHECK ((source = 'import') = (import_batch_id IS NOT NULL)),
  CONSTRAINT ck_expenses_void_actor CHECK ((voided_at IS NULL) = (voided_by IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expenses (organization_id, occurred_on);
CREATE INDEX IF NOT EXISTS idx_expenses_org_category ON expenses (organization_id, LOWER(category));
CREATE INDEX IF NOT EXISTS idx_expenses_import_batch ON expenses (import_batch_id);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_events (entity_type, entity_id);
