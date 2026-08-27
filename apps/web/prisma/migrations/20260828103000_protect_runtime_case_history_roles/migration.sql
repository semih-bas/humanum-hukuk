DO $$
DECLARE
    runtime_role TEXT;
BEGIN
    FOR runtime_role IN
        SELECT rolname
        FROM pg_roles
        WHERE rolname IN ('humanum_app', 'humanum_acceptance_app')
    LOOP
        EXECUTE format(
            'REVOKE DELETE ON TABLE %I, %I, %I, %I, %I FROM %I',
            'case_file',
            'case_file_change',
            'case_note',
            'case_document',
            'case_reminder',
            runtime_role
        );
        EXECUTE format(
            'REVOKE UPDATE ON TABLE %I FROM %I',
            'case_file_change',
            runtime_role
        );
    END LOOP;
END
$$;
