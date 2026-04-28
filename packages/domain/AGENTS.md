# Domain Package (`@sideline/domain`)

Core domain models, schemas, API contracts, and RPC endpoint definitions. This package has **no I/O dependencies** — it's pure domain logic.

## Structure

```
src/
├── models/          — Entity definitions (User, Session, Team, etc.)
├── api/             — Shared HTTP API contracts (HttpApiGroup spec)
└── rpc/             — RPC endpoint definitions (schemas + groups)
```

## Model.Class

Use `Model.Class` from `@effect/sql` to define database models with variant-based schemas:

```typescript
import { Model } from '@effect/sql';
import { Schema } from 'effect';

export const UserId = Schema.String.pipe(Schema.brand('UserId'));
export type UserId = typeof UserId.Type;

export class User extends Model.Class<User>('User')({
  id: Model.Generated(UserId),
  discord_id: Schema.String,
  discord_avatar: Schema.OptionFromNullOr(Schema.String),
  discord_access_token: Model.Sensitive(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
```

### Field Helpers

- **`Model.Generated(schema)`** — DB-generated fields (excluded from `insert` variant)
- **`Model.Sensitive(schema)`** — fields excluded from `json` variants (tokens, secrets)
- **`Model.DateTimeInsertFromDate`** — auto-managed insert timestamp (`Date` → `DateTime.Utc`)
- **`Model.DateTimeUpdateFromDate`** — auto-managed timestamp for both insert and update
- **`Schema.OptionFromNullOr(schema)`** — nullable DB columns (decodes `T | null` → `Option<T>`, encodes back to `T | null`)

### Conventions

- Use **snake_case** field names matching DB columns directly — no `fieldFromKey` mapping needed
- Use **branded types** for IDs (e.g., `UserId`, `TeamId`) instead of raw `Schema.String`
- Use `.make()` for known-valid literals, `Schema.decodeSync()` at system boundaries
- **DateTime convention**: Always use Effect's `DateTime` classes (`DateTime.Utc`, `DateTime.Zoned`) — never raw JS `Date`. Store instants as `TIMESTAMPTZ` in the DB and use `Schemas.DateTimeFromDate` from `@sideline/effect-lib`.

## Schema Patterns

- **Never use `Schema.optional`** — always use `Schema.optionalWith({ as: 'Option' })` or `Schema.OptionFromNullOr(...)` so optional values are `Option<T>` instead of `T | undefined`
- **`Schema.OptionFromNullOr`** for nullable API/DB fields — decodes `null`/`undefined` → `Option.none()`, values → `Option.some(value)`

### Shared Schemas Across API Contracts

When multiple API groups need the same schema, define it in one `api/*.ts` file and re-export from others:

```typescript
// src/api/GroupApi.ts — defines HexColor
export const HexColor = Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/));

// src/api/Roster.ts — re-exports HexColor
import { HexColor } from '~/api/GroupApi.js';
export { HexColor };
```

Current shared schemas:

| Schema | Defined in | Re-exported by |
|--------|-----------|----------------|
| `HexColor` | `src/api/GroupApi.ts` | `src/api/Roster.ts` |

## RPC Folder Import Rule

Files under `src/rpc/**` must import models from their concrete paths (e.g. `import * as Discord from '~/models/Discord.js'`), **not** via the barrel `~/index.js`. The barrel re-exports both `models/*` and `rpc/*`, and rpc files transitively pulled in through the barrel before their model dependencies finish initialising — at runtime this surfaces as `Cannot read properties of undefined (reading 'ast')` when a `Schema.TaggedClass` or `RpcGroup.make` references e.g. `Team.TeamId`. Always import models directly inside `src/rpc/**`.

## Build Requirement

**Critical**: After changing source files in this package, always rebuild before running type checks or tests in consuming packages:

```bash
pnpm build
```

Workspace packages use `publishConfig.directory: "dist"`, so pnpm symlinks consumers to `packages/domain/dist/`. Stale `.d.ts` files in `dist/` cause false type errors.
