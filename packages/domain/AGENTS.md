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

### Externally-Fetched URLs (SSRF guard)

Any user-supplied URL that the server (or a downstream service such as Discord) will fetch or render MUST be validated with the SSRF guard pattern, not just `Schema.pattern(/^https:/)`. Reference implementation: `EventImageUrl` in `src/api/EventApi.ts`.

The schema MUST enforce all of the following via `Schema.check(Schema.makeFilter<string>(...))`:

1. Parses with `new URL(value)` — reject otherwise.
2. `url.protocol === 'https:'` — reject `http:`, `data:`, `javascript:`, `file:`, `ftp:`, etc.
3. Hostname (after stripping IPv6 brackets) does NOT match the private-IPv4 pattern: `localhost`, `127.`, `10.`, `172.(16-31).`, `192.168.`, `169.254.`, `0.0.0.0`.
4. Hostname does NOT match the private-IPv6 pattern: `::1`, `::`, `fc00::/7` (`fc..:`/`fd..:`), link-local `fe80::/10` (`fe8x:`–`febx:`), and IPv4-mapped `::ffff:`.
5. A `Schema.isMaxLength(2048)` cap.

The filter predicate returns `true` on success and a human-readable error string on failure (so decode errors are descriptive). Do NOT replace the IPv4/IPv6 patterns with a synchronous DNS lookup — domain schemas must remain pure (no I/O). The patterns block IP-literal URLs at the schema layer; defence-in-depth (e.g. egress filtering, DNS rebinding mitigation) is the consuming service's responsibility.

When adding a new URL field, copy the `isValidEventImageUrl` predicate verbatim and rename it; do not partially reimplement the checks.

## RPC Folder Import Rule

Files under `src/rpc/**` must import models from their concrete paths (e.g. `import * as Discord from '~/models/Discord.js'`), **not** via the barrel `~/index.js`. The barrel re-exports both `models/*` and `rpc/*`, and rpc files transitively pulled in through the barrel before their model dependencies finish initialising — at runtime this surfaces as `Cannot read properties of undefined (reading 'ast')` when a `Schema.TaggedClass` or `RpcGroup.make` references e.g. `Team.TeamId`. Always import models directly inside `src/rpc/**`.

## Build Requirement

**Critical**: After changing source files in this package, always rebuild before running type checks or tests in consuming packages:

```bash
pnpm build
```

Workspace packages use `publishConfig.directory: "dist"`, so pnpm symlinks consumers to `packages/domain/dist/`. Stale `.d.ts` files in `dist/` cause false type errors.
