DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'export_audit'
    ) THEN
        RAISE EXCEPTION 'v7_01 verify: export_audit is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'export_audit'
          AND column_name = 'exported_by'
    ) THEN
        RAISE EXCEPTION 'v7_01 verify: exported_by is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'export_audit'
          AND column_name = 'exported_at'
    ) THEN
        RAISE EXCEPTION 'v7_01 verify: exported_at is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'export_audit'
          AND column_name = 'exporter_role'
    ) THEN
        RAISE EXCEPTION 'v7_01 verify: exporter_role is missing';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'export_audit'
          AND column_name = 'filters'
    ) THEN
        RAISE EXCEPTION 'v7_01 verify: filters is missing';
    END IF;
    IF NOT has_table_privilege('coop_app', 'public.export_audit', 'INSERT') THEN
        RAISE EXCEPTION 'v7_01 verify: coop_app cannot insert export_audit';
    END IF;
    IF NOT has_sequence_privilege('coop_app', 'public.export_audit_export_id_seq', 'USAGE') THEN
        RAISE EXCEPTION 'v7_01 verify: coop_app cannot use export_audit sequence';
    END IF;
    RAISE NOTICE 'v7_01 verify: ok';
END $$;
