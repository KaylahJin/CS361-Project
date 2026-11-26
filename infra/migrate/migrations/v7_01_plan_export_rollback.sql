BEGIN;
REVOKE USAGE, SELECT ON SEQUENCE public.export_audit_export_id_seq FROM coop_app;
REVOKE INSERT ON TABLE public.export_audit FROM coop_app;
DROP TABLE IF EXISTS export_audit;
COMMIT;
