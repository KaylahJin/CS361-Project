-- V3-02 attachments: upgrade
--
-- Files attached to a coop plan (PDF only, 5 MB max). The bytes live in the
-- private S3 bucket; this table is the register of what is stored where.
--
-- Safe to re-run: every statement is guarded.

BEGIN;

CREATE TABLE IF NOT EXISTS plan_attachments (
    attachment_id SERIAL PRIMARY KEY,
    plan_id       INTEGER NOT NULL REFERENCES coop_plans(plan_id) ON DELETE CASCADE,
    -- Built by the server (plans/{plan_id}/{uuid}.pdf), never taken from the
    -- client, and never derived from the user's file name.
    s3_key        TEXT NOT NULL UNIQUE,
    file_name     TEXT NOT NULL,
    content_type  VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    size_bytes    INTEGER NOT NULL,
    uploaded_by   VARCHAR(64) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_plan_attachments_type
        CHECK (content_type = 'application/pdf'),
    CONSTRAINT chk_plan_attachments_size
        CHECK (size_bytes > 0 AND size_bytes <= 5242880),
    CONSTRAINT chk_plan_attachments_name
        CHECK (length(btrim(file_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_plan_attachments_plan ON plan_attachments(plan_id);

-- Add the uploader FK after app_users exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'public.plan_attachments'::regclass
      AND c.contype = 'f'
      AND a.attname = 'uploaded_by'
  ) THEN
    ALTER TABLE plan_attachments
      ADD CONSTRAINT fk_plan_attachments_uploader
      FOREIGN KEY (uploaded_by) REFERENCES app_users(cognito_sub);
  END IF;
END $$;

COMMIT;