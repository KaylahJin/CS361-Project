BEGIN;

CREATE TABLE IF NOT EXISTS export_audit (
    export_id      BIGSERIAL PRIMARY KEY,
    exported_by    TEXT NOT NULL,
    exporter_role  TEXT NOT NULL,
    exported_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filters        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_export_audit_exported_at
    ON export_audit(exported_at DESC);

GRANT INSERT ON TABLE public.export_audit TO coop_app;
GRANT USAGE, SELECT ON SEQUENCE public.export_audit_export_id_seq TO coop_app;

COMMIT;
