# Humanum Hukuk

An internal case and document management application for Humanum Hukuk.

## Project status

The project is currently under development.

## Planned V1 features

- Secure employee login
- Dashboard
- Case list
- Create a new case
- Document upload and management
- Case status tracking

## Tech stack

- Next.js
- TypeScript
- PostgreSQL
- Docker Compose

## Local database

The development database runs in Docker and is only exposed on
`127.0.0.1:5432`.

Create `apps/web/.env.docker` from `apps/web/.env.docker.example` and replace
every placeholder password with a different strong random value. The real file
is ignored by Git and must never be committed.

Start PostgreSQL and wait for its health check:

```powershell
docker compose up --detach --wait database
```

Check its status:

```powershell
docker compose ps
```

Stop it without deleting data:

```powershell
docker compose stop database
```

Do not use `docker compose down --volumes` for routine shutdowns. The
`--volumes` option permanently deletes the local database data.

## Acceptance test environment

The acceptance environment is completely separate from development. It uses
the `humanum-acceptance-postgres-data` and `humanum-acceptance-documents`
volumes, PostgreSQL port `55432`, and application port `3001`.

Create the three ignored files from their `.example` counterparts, using
different strong random values for every password and secret:

- `apps/web/.env.acceptance.database`
- `apps/web/.env.acceptance.app`
- `apps/web/.env.acceptance.bootstrap`

Start and verify it from the repository root:

```powershell
docker compose -f compose.acceptance.yaml up --detach --build --wait
Set-Location apps/web
npm run db:bootstrap:acceptance
```

Open `http://localhost:3001/login` and sign in with
`admin@humanum.local`. The bootstrap command creates only this administrator
and does not print the password. Keep the acceptance volumes until testing is
complete; never use `down --volumes` without explicit approval.

Database roles are separated by responsibility:

- `humanum_admin`: bootstrap administration only
- `humanum_migrator`: schema migrations
- `humanum_app`: application runtime queries

## Prisma connection checks

Run these commands from `apps/web`:

```powershell
npm run db:validate
npm run db:generate
npm run db:check
```

The generated Prisma Client is excluded from Git and must be regenerated after
installing dependencies. `db:check` connects with the restricted
`humanum_app` role and also verifies that it cannot create database tables.

Acceptance fixtures are identified by `ACCEPTANCE_FIXTURE_BATCH`. Cleanup is a
dry run unless both the exact batch confirmation and `--apply` are supplied:

```powershell
docker-compose -f compose.acceptance.yaml --profile tools run --rm --no-deps fixtures npm run db:fixtures:cleanup
docker-compose -f compose.acceptance.yaml --profile tools run --rm --no-deps -e ACCEPTANCE_FIXTURE_CLEANUP_CONFIRM=HH-ACC-20260831-V1 fixtures npm run db:fixtures:cleanup -- --apply
```

Always inspect the preview first. The command refuses non-acceptance targets,
preserves an active verified administrator, rejects references that cross the
selected batch boundary, quarantines document files before the database
transaction, and verifies protected record counts before purging quarantine.
It does not remove unrelated users, cases, audit history or local editor files.

Prisma is pinned to the stable `7.10.0` release. The `deepmerge-ts` dependency
is overridden to the patched `8.0.0` release because versions below 8 are
affected by `GHSA-ggr8-5vv4-36mx`. Do not remove the override unless Prisma
uses a patched dependency and `npm audit` remains clean.
