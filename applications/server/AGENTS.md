# Server Application (`@sideline/server`)

HTTP API server built with Effect-TS and PostgreSQL.

## Architecture

```
src/
├── api/             — HTTP API modules (errors, health, auth, composition)
├── repositories/    — Database repositories (Sessions, Users, Teams, etc.)
├── services/        — External service integrations (DiscordOAuth)
├── middleware/       — HTTP middleware (AuthMiddlewareLive)
├── rpc/             — RPC handler implementations
├── AppLive.ts       — Composable app layer (HTTP + API + Repos)
└── run.ts           — Runtime entrypoint (Pg, migrations, NodeRuntime)
```

Follows the **AppLive + run.ts** pattern:
- **`AppLive`** — composable `Layer` that wires up services without runtime concerns
- **`run.ts`** — provides PgClient, NodeHttpServer, Logger, Config and calls `NodeRuntime.runMain`

## Database & SQL Patterns

### Model.Class

Use `Model.Class` from `@effect/sql` for database models. See `packages/domain/AGENTS.md` for model definition patterns.

### SqlSchema Helpers

Use `SqlSchema` helpers for custom queries with schema-validated inputs/outputs:

- **`SqlSchema.findOne`** — returns `Option<T>` (first row or `None`)
- **`SqlSchema.single`** — returns `T` (first row, fails with `NoSuchElementException` if empty)
- **`SqlSchema.void`** — discards result (for DELETE/UPDATE without RETURNING)
- **`SqlSchema.findAll`** — returns `ReadonlyArray<T>`

```typescript
const findByDiscordId = SqlSchema.findOne({
  Request: Schema.String,
  Result: User,
  execute: (discordId) => sql`SELECT * FROM users WHERE discord_id = ${discordId}`,
});
```

### Repository Pattern

Construct repositories by starting from `SqlClient.SqlClient.pipe(Effect.bindTo('sql'), ...)`. Use `Effect.bind` for effectful dependencies and `Effect.let` for pure method definitions. End with `Bind.remove` to strip internals.

```typescript
import { Bind } from '@sideline/effect-lib';

export class UsersRepository extends Effect.Service<UsersRepository>()('api/UsersRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.bind('repo', () =>
      Model.makeRepository(User, {
        tableName: 'users',
        spanPrefix: 'UsersRepository',
        idColumn: 'id',
      }),
    ),
    Effect.let('findById', ({ repo }) => (id: UserId) => repo.findById(id)),
    Effect.let('findByDiscordId', ({ sql }) =>
      SqlSchema.findOne({
        Request: Schema.String,
        Result: User,
        execute: (discordId) => sql`SELECT * FROM users WHERE discord_id = ${discordId}`,
      }),
    ),
    Bind.remove('sql'),
    Bind.remove('repo'),
  ),
}) {}
```

### Model.makeRepository

Use for standard CRUD operations. Returns `findById` (→ `Option<T>`), `insert`, `update`, `delete`.

```typescript
const repo = Model.makeRepository(User, {
  tableName: 'users',
  spanPrefix: 'UsersRepository',
  idColumn: 'id',
});
```

## RPC Transport

Sync RPCs share a single `RoleSyncRpcs` group served at `/rpc/role-sync` (NDJSON over HTTP). Both role sync and channel sync RPCs live in the same group.

- **Domain**: `packages/domain/src/rpc/RoleSyncRpc.ts` — RPC definitions
- **Server**: `src/rpc/RoleSyncRpcLive.ts` — RPC handler implementations

## Sync Event Pattern

When API handlers create/delete resources that need Discord sync:

1. Perform the primary operation (e.g. insert group)
2. Call `repo.emitIfGuildLinked(teamId, eventType, ...)` — looks up `guild_id` from `teams` table; if linked, inserts event row; if not, no-op
3. Wrap emission in `Effect.catchAll(() => Effect.void)` so sync failures never break the primary operation

### Discord Name Formatting

The **server** applies Discord name formatting before emitting sync events. The bot receives pre-formatted `discord_channel_name` and `discord_role_name` fields and uses them directly.

| Constant | Value | Location |
|----------|-------|----------|
| `DEFAULT_ROLE_FORMAT` | `{emoji} {name}` | `src/utils/applyDiscordFormat.ts` |
| `DEFAULT_CHANNEL_FORMAT` | `{emoji}│{name}` | `src/utils/applyDiscordFormat.ts` |

Format templates use `{emoji}` and `{name}` placeholders. The `applyDiscordFormat(template, name, emoji)` function handles missing emoji by stripping the placeholder and cleaning up leftover separators.

When emitting `channel_created`, `roster_channel_created`, or `channel_updated` events:

1. Load team settings via `teamSettings.findByTeamId(teamId)`
2. Resolve the channel format: `Option.match(settings, { onNone: () => DEFAULT_CHANNEL_FORMAT, onSome: (s) => s.discord_channel_format })`
3. Resolve the role format: same pattern with `discord_role_format`
4. Call `applyDiscordFormat(format, entityName, entityEmoji)` for both channel and role names
5. Pass the formatted names as `discordChannelName` and `discordRoleName` to the emit method
6. For entities with a `color` field (hex string like `#FF0000`), convert to Discord integer using `hexColorToDiscordInt` from `src/utils/hexColorToDiscordInt.ts` and pass as `discordRoleColor`

## Testing

Tests go in `test/` directory. When adding new repositories, add corresponding mock implementations to all test files that compose `AppLive` (e.g., `MockChannelSyncEventsRepository`).
