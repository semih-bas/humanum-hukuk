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

Database roles are separated by responsibility:

- `humanum_admin`: bootstrap administration only
- `humanum_migrator`: schema migrations
- `humanum_app`: application runtime queries
