#!/bin/sh
set -eu

psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=migration_user="$HUMANUM_MIGRATION_DB_USER" \
  --set=migration_password="$HUMANUM_MIGRATION_DB_PASSWORD" \
  --set=app_user="$HUMANUM_APP_DB_USER" \
  --set=app_password="$HUMANUM_APP_DB_PASSWORD" <<'EOSQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION',
  :'migration_user',
  :'migration_password'
) \gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION',
  :'app_user',
  :'app_password'
) \gexec

SELECT format(
  'ALTER DATABASE %I OWNER TO %I',
  current_database(),
  :'migration_user'
) \gexec

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user') \gexec
GRANT USAGE ON SCHEMA public TO :"app_user";

SELECT format('SET ROLE %I', :'migration_user') \gexec
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
RESET ROLE;
EOSQL
