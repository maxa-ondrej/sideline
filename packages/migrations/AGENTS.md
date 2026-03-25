# Migrations Package (`@sideline/migrations`)

Database migrations using Effect SQL with PostgreSQL.

## Architecture

Exports `MigratorLive` — a layer that only needs a `PgClient` and filesystem. Consumers (like `server/run.ts`) provide their own `PgClient`, keeping this package decoupled from connection config.

## Migration Files

Migration files live in `src/` and follow the naming pattern:

```
{timestamp}_{description}.ts
```

Example: `1740970000_create_role_sync.ts`

## Conventions

- Migrations are applied in timestamp order
- Each migration should be idempotent where possible
- Use `TIMESTAMPTZ` for all timestamp columns
- Use `VARCHAR` with appropriate lengths for string columns
- Add appropriate indexes for frequently queried columns
- Foreign keys should have `ON DELETE` behavior specified
