-- Concurrency-safe source for human-readable case reference numbers.
CREATE SEQUENCE "case_file_reference_sequence"
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

GRANT USAGE, SELECT ON SEQUENCE "case_file_reference_sequence" TO humanum_app;
