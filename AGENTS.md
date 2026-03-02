# AGENTS.md

## Project Overview

This is an **Effect-TS monorepo** built with TypeScript, utilizing a modern functional programming approach. The project emphasizes type safety, composable effects, and structured concurrency through the Effect ecosystem.

### Architecture

```
applications/
├── bot/       - Discord bot (dfx, Effect-native)
│   ├── Bot.ts           - Composes commands + interactions + events into program
│   ├── AppLive.ts       - Composable app layer (DiscordIx → HealthServer)
│   ├── HealthServerLive.ts - Health check HTTP endpoint with gateway shard status
│   ├── env.ts           - Environment config (token, intents, health port)
│   ├── run.ts           - Runtime entrypoint (config, logging, NodeRuntime)
│   ├── commands/        - Slash command registry (ping.ts, index.ts)
│   ├── interactions/    - Component interaction registry (buttons/selects/modals)
│   └── events/          - Gateway event handler registry (guild, member lifecycle)
├── server/    - Server application and API endpoints
│   ├── api/             - HTTP API modules (errors, health, auth, composition)
│   ├── repositories/    - Database repositories (Sessions, Users)
│   ├── services/        - External service integrations (DiscordOAuth)
│   ├── middleware/       - HTTP middleware (AuthMiddlewareLive)
│   ├── AppLive.ts       - Composable app layer (HTTP + API + Repos)
│   └── run.ts           - Runtime entrypoint (Pg, migrations, NodeRuntime)
└── web/       - TanStack Start frontend (Vite, React 19, Nitro)
packages/
├── domain/    - Core domain logic and business rules
│   ├── models/          - Entity definitions (User, Session)
│   └── api/             - Shared HTTP API contracts (Auth)
└── migrations/- Database migrations (provides MigratorLive layer)
```

Each application follows an **AppLive + run.ts** pattern:
- **`AppLive`** — a composable `Layer` that wires up the application's core services without runtime concerns (config, logging, connection details). This is the unit that can be tested or composed into larger systems.
- **`run.ts`** — the deployment entrypoint that provides environment-specific layers (PgClient, NodeHttpServer, Logger, Config) and calls `NodeRuntime.runMain`.

The **migrations** package exports `MigratorLive` — a layer that only needs a `PgClient` and filesystem. Consumers (like `server/run.ts`) provide their own `PgClient`, keeping the migration package decoupled from connection config.

This monorepo follows Effect's best practices for dependency management using covariant union types for the `R` (Requirements) parameter, enabling clean composition without intersection type conflicts.

## Technology Stack

### Core Technologies

- **TypeScript 5.6+** - Strict mode enabled with comprehensive type checking
- **Effect-TS 3.10+** - Functional effect system for composable, type-safe programs
- **pnpm** - Fast, disk-efficient package manager (workspace-aware)
- **Vitest 3.2+** - Fast unit testing with native ESM support
- **tsx** - TypeScript execution engine for Node.js

### Build & Development

- **TypeScript Compiler** - Project references for incremental builds
- **Vitest** - Testing framework with Effect integration (`@effect/vitest`)
- **Changesets** - Version management and changelog generation
- **Biome.js** - Fast linting and formatting

## Effect-TS Patterns

### The Effect Type

```typescript
Effect<Success, Error, Requirements>
```

- `Success (A)` - The value type on success
- `Error (E)` - The error type(s) that can occur
- `Requirements (R)` - Services/dependencies needed to run

**Key Principle**: Effects are **blueprints**, not imperative actions. They describe programs that the runtime executes.

### Dependency Injection

Use **covariant union types** (not intersections) for services:

```typescript
// Define services with Effect.Tag
class DatabaseService extends Effect.Tag("DatabaseService")<
  DatabaseService,
  { query: (sql: string) => Effect.Effect<Result> }
>() {}

// Compose dependencies naturally
const program = Effect.gen(function* () {
  const db = yield* DatabaseService
  const cache = yield* CacheService
  // Dependencies merge as R = DatabaseService | CacheService
})
```

### Service Patterns

- Use `Effect.Tag` for service definitions with static method access
- Use `Layer` for service construction and dependency wiring
- Use `ManagedRuntime` for service lifecycle in external frameworks
- Prefer `Effect.provide` over manual dependency passing

### Configuration

```typescript
import { Config } from "effect"

// Declarative configuration
const dbUrl = Config.string("DATABASE_URL")
const port = Config.number("PORT").pipe(Config.withDefault(3000))
const apiKey = Config.redacted("API_KEY") // For sensitive values

// Combine configs
const appConfig = Config.all({
  dbUrl,
  port,
  apiKey
})
```

- Default provider reads environment variables
- Use `Config.withDefault` for fallbacks
- Use `Config.redacted` for secrets

### Error Handling

```typescript
// Typed errors automatically merge into unions
const program = Effect.gen(function* () {
  yield* httpCall // Error = HttpError
  yield* dbQuery  // Error = HttpError | DatabaseError
})

// Handle specific errors
program.pipe(
  Effect.catchTag("HttpError", handleHttpError),
  Effect.catchTag("DatabaseError", handleDatabaseError),
  Effect.retry(Schedule.exponential("100 millis"))
)
```

### Resource Management

Effect provides automatic resource cleanup via try-finally semantics:

```typescript
const withConnection = Effect.acquireRelease(
  openConnection,
  (conn) => Effect.sync(() => conn.close())
)

// Resources cleaned up even on interruption
Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* withConnection
    yield* useConnection(conn)
  })
)
```

### Batching & Caching

```typescript
import { Request, RequestResolver, Effect } from "effect"

// Define requests
interface GetUser extends Request.Request<User, UserError> {
  readonly id: string
}

// Batch resolver
const userResolver = RequestResolver.makeBatched(
  (requests: GetUser[]) => {
    const ids = requests.map(r => r.id)
    return fetchUsers(ids).pipe(
      Effect.map(users => requests.map(req =>
        Request.succeed(req, users[req.id])
      ))
    )
  }
)

// Automatic batching + caching
const getUser = (id: string) =>
  Effect.request(makeGetUser(id), userResolver).pipe(
    Effect.withRequestCaching(true)
  )
```

### Database & SQL Patterns

#### Model.Class

Use `Model.Class` from `@effect/sql` to define database models with variant-based schemas. Each model automatically generates `select`, `insert`, `update`, and `json` schema variants.

```typescript
import { Model } from '@effect/sql';
import { Schema } from 'effect';

export const UserId = Schema.String.pipe(Schema.brand('UserId'));
export type UserId = typeof UserId.Type;

export class User extends Model.Class<User>('User')({
  id: Model.Generated(UserId),           // excluded from insert (DB generates)
  discord_id: Schema.String,
  discord_avatar: Schema.NullOr(Schema.String),
  discord_access_token: Model.Sensitive(Schema.String),  // excluded from json variants
  created_at: Model.DateTimeInsertFromDate,  // auto-managed insert timestamp
  updated_at: Model.DateTimeUpdateFromDate,  // auto-managed update timestamp
}) {}
```

Key field helpers:
- **`Model.Generated(schema)`** — DB-generated fields (excluded from `insert` variant)
- **`Model.Sensitive(schema)`** — fields excluded from `json` variants (tokens, secrets)
- **`Model.DateTimeInsertFromDate`** — auto-managed insert timestamp (`Date` → `DateTime.Utc`)
- **`Model.DateTimeUpdateFromDate`** — auto-managed timestamp for both insert and update
- **`Schema.NullOr(schema)`** — nullable DB columns (simpler than `Model.FieldOption`)

Use **snake_case** field names matching DB columns directly — no `fieldFromKey` mapping needed.

#### Model.makeRepository

Use `Model.makeRepository` for standard CRUD operations. Returns `findById` (→ `Option<T>`), `insert`, `update`, `delete`.

```typescript
const repo = Model.makeRepository(User, {
  tableName: 'users',
  spanPrefix: 'UsersRepository',
  idColumn: 'id',
});
```

#### SqlSchema Helpers

Use `SqlSchema` helpers for custom queries with schema-validated inputs and outputs:

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

#### Repository Pattern

Construct repositories by starting from `SqlClient.SqlClient.pipe(Effect.bindTo('sql'), ...)`. Use `Effect.bind` for effectful dependencies (like `Model.makeRepository`) and `Effect.let` for pure method definitions (like `SqlSchema` queries). End with `Bind.remove` (from `@sideline/effect-lib`) to strip internals (`sql`, `repo`) from the service type.

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

## Development Guidelines

### TypeScript Configuration

- **Strict mode enabled**: All strict flags are on
- **Module resolution**: NodeNext (ESM-first)
- **Target**: ES2022
- **Decorators enabled**: For Effect service definitions
- **Effect language service**: Provides enhanced IDE support
- **Project references**: Used for incremental compilation

### Import Conventions

```typescript
// Use .js extensions in imports (TypeScript + ESM)
import { pipe } from "effect"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

// Workspace imports
import { DomainService } from "@sideline/domain"
import * as Domain from "@sideline/domain/models"
```

### Path Aliases

Internal packages use scoped aliases:

```typescript
@sideline/bot        → ./applications/bot/src
@sideline/domain     → ./packages/domain/src
@sideline/server     → ./applications/server/src
```

### Code Style

- **Never use `Effect.gen(function* () {`** — instead use `Effect.Do.pipe(...)` with `Effect.bind` / `Effect.let` / `Effect.tap` for sequential operations
- **Use `pipe`** for linear transformations and chaining
- **Always use `Effect.asVoid`** instead of `Effect.map(() => undefined as undefined)`
- **Never cast types** (`as X`) and **never use `any`** — fix the types properly instead
- **Never use `Schema.optional`** — always use `Schema.optionalWith({ as: 'Option' })` or `Schema.OptionFromNullOr(...)` so optional values are represented as `Option<T>` instead of `T | undefined`
- **Type narrow errors** - use discriminated unions for error types
- **Document complex Effect chains** - explain the business logic, not the syntax

### Testing Strategy

#### Test Structure

```typescript
import { Effect, Exit } from "effect"
import { describe, it, expect } from "@effect/vitest"

describe("MyService", () => {
  it.effect("should handle success case", () =>
    Effect.gen(function* () {
      const result = yield* myOperation
      expect(result).toEqual(expected)
    })
  )
})
```

#### Test Utilities

- **`it.effect`** - Run Effect programs as tests
- **`TestClock`** - Control time for deterministic testing
- **`TestRandom`** - Deterministic randomness
- **`ConfigProvider.fromMap`** - Mock configuration
- **`Effect.provide`** - Supply test implementations of services

#### Running Tests

```bash
pnpm test                    # Run all tests
pnpm test --watch            # Watch mode
pnpm coverage                # Generate coverage report
TEST_DIST=1 pnpm test        # Test built artifacts
```

## Project Structure

### Monorepo Layout

```
/
├── applications/
│   └── web/               - TanStack Start frontend (own Vite build)
├── applications/
│   ├── bot/
│   │   ├── src/           - Discord bot source (dfx)
│   │   ├── test/          - Bot tests
│   │   └── package.json
│   ├── server/
│   │   ├── src/           - Server source code
│   │   ├── test/          - Server tests
│   │   └── package.json
│   └── web/               - TanStack Start frontend (own Vite build)
├── packages/
│   ├── domain/
│   │   ├── src/           - Domain models and logic
│   │   ├── test/          - Domain tests
│   │   └── package.json
│   └── migrations/
│       ├── src/           - Database migration files
│       └── package.json
├── .github/workflows/     - CI workflows (check, release, snapshot)
├── scripts/               - Build and utility scripts
├── patches/               - pnpm patches for dependencies
├── .changeset/            - Changeset configurations
├── vitest.shared.ts       - Shared Vitest configuration
├── vitest.workspace.ts    - Vitest workspace setup
├── tsconfig.base.json     - Base TypeScript config
├── tsconfig.build.json    - Build configuration
└── package.json           - Root package with scripts
```

### Package Structure Conventions

Each package follows this structure:

```
packages/{name}/
├── src/
│   ├── index.ts           - Main entry point (must export public API)
│   ├── {Feature}/         - Feature-based organization
│   │   ├── services.ts    - Effect services
│   │   ├── models.ts      - Domain models (Effect Schema)
│   │   ├── effects.ts     - Effect programs
│   │   └── layers.ts      - Layer construction
├── test/
│   └── *.test.ts          - Test files
├── package.json
├── tsconfig.json          - Package config (extends base)
├── tsconfig.src.json      - Source-only config
├── tsconfig.test.json     - Test config
└── tsconfig.build.json    - Build config
```

## Common Tasks

### Running Code

Execute TypeScript files directly:

```bash
pnpm tsx ./path/to/file.ts
```

### Building

```bash
pnpm build               # Build all packages (TypeScript + package builds)
pnpm check               # Type check without building (excludes web app)
```

Build process:
1. TypeScript compilation (`tsc -b tsconfig.build.json`)
2. Package-specific builds (if configured)

### Pre-commit Hooks

The repo uses **husky** + **lint-staged** to run `biome check --write` on staged files before each commit. This catches formatting and lint issues locally before they hit CI.

- Hooks are installed automatically via the `prepare` script on `pnpm install`.
- The pre-commit hook lives in `.husky/pre-commit` and runs `pnpm exec lint-staged`.
- `lint-staged` config is in the root `package.json`.

### Branching & PR Strategy

The project follows **trunk-based development** on `main`:

- **`main`** is the single long-lived branch. All work merges here.
- **Feature branches** branch off `main` and are merged back via pull request.
- **PRs to `main`** trigger the Check workflow (lint, types, build, test) and a Snapshot build (`pkg-pr-new`) for preview packages.
- **Pushes to `main`** trigger the Check workflow plus the Release workflow (Changesets action creates a release PR or publishes).

#### Workflow

1. Create a feature branch from `main`
2. Make changes, commit (pre-commit hooks run biome automatically)
3. Open a PR against `main` — CI runs checks + snapshot build
4. After review, squash-merge into `main`
5. For publishable changes, add a changeset (`pnpm changeset`) before merging

#### Branch naming

Use descriptive kebab-case names: `feat/rsvp-buttons`, `fix/auth-token-refresh`, `docs/setup-guide`.

### Development Workflow

```bash
# Check types while developing
pnpm check

# Run specific package tests
cd packages/domain && pnpm test

# Run all tests from root
pnpm test

# Clean build artifacts
pnpm clean
```

### Version Management

```bash
# Create a changeset
pnpm changeset

# Version packages based on changesets
pnpm changeset-version

# Build, test, and publish
pnpm changeset-publish
```

#### Changeset bump rules

- **patch** — small features, bug fixes, refactors
- **minor** — larger features, significant new functionality
- **major** — never bump major. This project does not use major version bumps.

## Vitest Configuration

### Shared Configuration

Located in `vitest.shared.ts`:

- **Target**: ES2020 (esbuild)
- **Fake timers**: Disabled (use TestClock from Effect)
- **Concurrent sequences**: Enabled for faster tests
- **Setup files**: Global test setup in `setupTests.ts`
- **Include pattern**: `test/**/*.test.ts`

### Running Tests

Vitest integrates with Effect through `@effect/vitest`:

- Use `it.effect` for Effect-based tests
- Use `it.scoped` for tests requiring scope
- Use `it.live` for tests with live services

## Biome.js - Code Formatting & Linting

Biome is configured for fast, comprehensive code quality checks across the monorepo.

### Configuration

The project uses `biome.json` in the root with:

- **Formatter**: 2-space indentation, 100-char line width, single quotes, semicolons, trailing commas
- **Linter**: All recommended rules enabled plus TypeScript-specific rules
- **Import Organization**: Automatic import sorting and unused import removal via `noUnusedImports`
- **Type-aware Rules**: `useImportType`, `useExportType` for proper type imports
- **VCS Integration**: Git-aware, respects `.gitignore`

### Scripts

Available npm scripts for code quality:

```bash
pnpm lint            # Check both formatting and linting
pnpm format          # Fix all auto-fixable issues (recommended)
```

### VS Code Integration

The project is configured for automatic formatting:

- **Format on Save**: Enabled for all supported file types
- **Organize Imports on Save**: Removes unused imports automatically
- **Default Formatter**: Biome for JS/TS/JSON/CSS files

Install the recommended extension: `biomejs.biome`

### Key Rules

- **Import Types**: Enforces `import type` for TypeScript types
- **Unused Code**: Errors on unused imports and variables
- **Explicit Any**: Warning (relaxed in test files)
- **Console**: Allowed (not blocked)
- **For-Each**: Warning to prefer modern alternatives

### Test File Overrides

Test files (`*.test.ts`, `*.spec.ts`) have relaxed rules:
- `noExplicitAny` is disabled for test utilities

### Running Biome

```bash
# Before committing
pnpm format

# Check specific files
pnpm biome check src/
```

## CI Pipeline

The `check.yml` workflow runs on pushes to `main` and on pull requests. It has four parallel jobs:

| Job             | Command                    | Purpose                                          |
|-----------------|----------------------------|--------------------------------------------------|
| **Lint & Format** | `pnpm lint`              | Enforces formatting and lint rules via Biome     |
| **Build**       | `pnpm codegen`             | Verifies codegen output is committed and current |
| **Types**       | `pnpm check`               | Type-checks all packages individually            |
| **Test**        | `pnpm build && pnpm test`| Builds packages, then runs Vitest tests          |

> **Why Test needs `pnpm build` first:** Workspace packages use `publishConfig.directory: "dist"`, so pnpm symlinks consumers to `packages/*/dist`. Vitest resolves imports through these symlinks, meaning built artifacts must exist before tests can run.

All jobs use the shared `.github/actions/setup` composite action (pnpm + Node.js install with caching).

### Docker / Snapshot Pipeline

The `snapshot.yml` workflow runs on pull requests and manual dispatch. It:

1. Publishes package snapshots via `pkg-pr-new`
2. Builds Docker images for all applications (`bot`, `server`, `web`) using their respective `Dockerfile`s
3. Pushes images to the GitHub Container Registry (`ghcr.io/maxa-ondrej/sideline/<app>`)
4. Tags images with the PR number and commit SHA

### Running CI checks locally

```bash
pnpm lint                  # Lint & format check
pnpm codegen && git diff --exit-code  # Verify codegen is up to date
pnpm check                 # Type check all packages
pnpm test                  # Run tests
```

## Best Practices

### Effect Program Structure

1. **Services First**: Define services at package boundaries
2. **Layers for Assembly**: Use Layers to wire up dependencies
3. **Errors as Values**: Model domain errors explicitly
4. **Schema Validation**: Use `effect/Schema` for runtime validation
5. **Resource Safety**: Use `Effect.acquireRelease` for resources

### Code Organization

- **Domain package**: Pure domain logic, no I/O dependencies
- **Server package**: HTTP, database, external integrations
- **Cross-cutting concerns**: Configuration, logging, observability

### Performance

- Enable request batching for multiple similar operations
- Use request caching to prevent redundant work
- Leverage concurrent effect execution (`Effect.all` with `concurrency` option)
- Use `Effect.withSpan` for distributed tracing

### Error Recovery

- Use `Effect.retry` with appropriate schedules
- Implement circuit breakers for external services
- Log errors at service boundaries
- Provide fallbacks for non-critical operations

## Common Patterns

### shadcn instructions

Use the latest version of Shadcn to install new components, like this command to add a button component:

```bash
pnpm -C ./applications/web dlx shadcn@latest add button
```

**Always prefer Shadcn components over plain HTML tags:**
- `<button>` → `<Button>` from `components/ui/button`
- `<a href>` → `<Button asChild><a href={...}>...</a></Button>`
- `<input>` → `<Input>` from `components/ui/input`
- `<select>` → `<Select>` from `components/ui/select`
- `<label>` (in forms) → `<FormLabel>` from `components/ui/form`

### Forms — React Hook Form + Effect Schema

**Always use Shadcn Form (`components/ui/form`) with React Hook Form and Effect Schema** for any form that collects user input to be submitted to the backend.

#### Setup

```typescript
import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { Effect, Option, Schema } from 'effect';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { ApiClient, ClientError, useRun } from '../../lib/runtime';

const MyFormSchema = Schema.Struct({
  name: Schema.NonEmptyString,
  // Use transforming schemas so decoded values map directly to the API payload:
  age: Schema.NumberFromString,
  role: Schema.Literal('admin', 'member'),
  // Optional numeric field — decoded as Option<number>:
  jerseyNumber: Schema.NumberFromString.pipe(Schema.optionalWith({ as: 'Option' })),
});
// Use the decoded/transformed type — this is what onSubmit receives:
type MyFormValues = Schema.Schema.Type<typeof MyFormSchema>;

function MyForm({ onSuccess }: { onSuccess: () => void }) {
  const run = useRun();
  // No explicit generic needed — effectTsResolver infers the type:
  const form = useForm({
    resolver: effectTsResolver(MyFormSchema),
    mode: 'onChange',
    defaultValues: { name: '' },
  });

  const onSubmit = async (values: MyFormValues) => {
    // values are already decoded (e.g. age is number, jerseyNumber is Option<number>)
    const result = await ApiClient.pipe(
      Effect.flatMap((api) => api.something.create({ payload: values })),
      Effect.catchAll(() => ClientError.make('Failed to save')),
      run,
    );
    if (Option.isSome(result)) onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='flex flex-col gap-4'>
        {/* Spread form.register('fieldName') on FormField — do NOT use control + name props: */}
        <FormField
          {...form.register('name')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* For Shadcn Select, bind via onValueChange/value, not field spread: */}
        <FormField
          {...form.register('role')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>...</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' disabled={form.formState.isSubmitting}>Submit</Button>
      </form>
    </Form>
  );
}
```

#### Key rules
- Use `effectTsResolver(MySchema)` from `@hookform/resolvers/effect-ts` — **not** `standardSchemaResolver`, not zod, not yup.
- Do **not** wrap the schema in `Schema.standardSchemaV1(...)` — pass it directly to `effectTsResolver`.
- Use transforming schemas (`NumberFromString`, `optionalWith({ as: 'Option' })`, `NonEmptyString`) so the decoded type maps directly to the API payload — no manual value transformation needed in `onSubmit`.
- `type FormValues = Schema.Schema.Type<typeof MySchema>` is the decoded/transformed type; use it as the `onSubmit` parameter type.
- Do **not** pass explicit generics to `useForm<MyFormValues>(...)` — let `effectTsResolver` infer the type.
- Spread `{...form.register('fieldName')}` on `<FormField>` — do **not** use `control={form.control} name='fieldName'` props.
- Use `form.formState.isSubmitting` for the loading state — no manual `submitting` state.
- Errors from the API are shown via automatic `toast.error` in `runPromiseClient` — no manual error state needed.
- `Option.isSome(result)` guards the success path since `run` returns `Promise<Option<A>>`.
- For `<Select>`, use `onValueChange={field.onChange}` and `value={field.value}` — do **not** spread `{...field}` directly on `<Select>`.


### Service Definition

```typescript
// Define the service interface
interface MyService {
  readonly doSomething: (input: string) => Effect.Effect<Result, MyError>
}

// Create service tag
class MyService extends Effect.Tag("MyService")<MyService, MyService>() {}

// Implement the service
const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    const dep = yield* DependencyService

    return {
      doSomething: (input) =>
        Effect.gen(function* () {
          // Implementation
        })
    }
  })
)
```

### Effect Program Template

```typescript
import { Effect } from "effect"

export const myProgram = Effect.gen(function* () {
  // Access services
  const service = yield* MyService

  // Perform effects
  const result = yield* service.doSomething("input")

  // Transform and return
  return result.value
})

// Provide dependencies and run
const runnable = myProgram.pipe(
  Effect.provide(MyServiceLive)
)

Effect.runPromise(runnable)
```

### Schema-Driven Development

```typescript
import * as Schema from "effect/Schema"

// Define schemas
class User extends Schema.Class<User>("User")({
  id: Schema.UUID,
  name: Schema.NonEmptyString,
  email: Schema.String.pipe(Schema.pattern(emailRegex)),
  createdAt: Schema.DateTimeUtc
}) {}

// Parse with Effect
const parseUser = Schema.decode(User)

// Use in programs
const program = Effect.gen(function* () {
  const data = yield* fetchUserData
  const user = yield* parseUser(data) // Fails with ParseError
  return user
})
```

## Troubleshooting

### Common Issues

**"Cannot find module" errors**
- Ensure imports use `.js` extensions
- Check `tsconfig.json` paths match actual structure
- Run `pnpm install` to sync dependencies

**Type errors with Effect**
- Ensure `@effect/language-service` is loaded in IDE
- Check that error types are properly handled or annotated
- Use `Effect.runSync` only with `Effect<A, never, never>`

**Test failures**
- Verify all services are provided in tests
- Use `it.effect` instead of regular `it` for Effect programs
- Check that resources are properly scoped

**Build failures**
- Run `pnpm clean` to remove stale artifacts
- Check `tsconfig.build.json` includes all necessary files
- Ensure project references are correctly configured

## Resources

### Documentation

- [Effect Documentation](https://effect.website/docs)
- [Effect Schema](https://effect.website/docs/schema)
- [Effect Changelog](https://effect.website/changelog)
- [Effect Discord](https://discord.gg/effect-ts)

### Learning Resources

- [Effect LLM Full Docs](https://effect.website/llms-full.txt)
- [Effect Workshop](https://github.com/Effect-TS/workshop)
- [Effect Examples](https://github.com/Effect-TS/examples)

## Task Management (Notion)

**Always use the Notion MCP integration to check for tasks, stories, and sprint work.** Never use GitHub Issues, Asana, or other tools for task management — Notion is the single source of truth.

Project tasks are managed in Notion via MCP integration. The workspace follows a four-level hierarchy:

```
Milestone → Epic → Story → Task
```

| Level     | Purpose                              | Example                              |
|-----------|--------------------------------------|--------------------------------------|
| Milestone | Major deliverable with target date   | v1 Launch                            |
| Epic      | Complete feature area                | RSVP and Attendance System           |
| Story     | User-facing value                    | As a player, I can RSVP via Discord  |
| Task      | Concrete dev work                    | Implement button interaction handler |

**Sprints** are orthogonal — stories and tasks are assigned to 2-week sprints for time-boxed execution.

### Notion Databases

| Database   | ID                                     |
|------------|----------------------------------------|
| Tasks      | `2e0b6b31-d3bd-4e32-a127-3eedf257f228` |
| Stories    | `9ec44d56-966b-4c3e-ba98-637b128c99a8` |
| Epics      | `a040ab6d-10bb-4575-8c80-d4e827238b03` |
| Milestones | `089dd440-070c-4cfb-a45d-1a68c299a2f2` |
| Sprints    | `a89cc7a7-ab1a-4e3f-945d-d42028c75f00` |

### Task Properties

- **Task** (title) — name of the task
- **Status** — `TODO` | `In Progress` | `Done`
- **Type** — `🛠️ Feature` | `🐛 Bug` | `📐 Design` | `🧪 Test` | `📝 Docs` | `⚙️ DevOps` | `🔄 Refactor`
- **Story** — relation to Stories database
- **Version** — `v1` | `v2`
- **Due Date** — target completion date
- **Estimate (hours)** — effort estimate
- **Notes** — additional context

### Working with Notion MCP

Use the Notion MCP tools to query and update tasks:
- `notion-search` — find tasks, stories, epics by keyword
- `notion-fetch` — get full details of a page or database by ID/URL
- `notion-update-page` — update task status, properties, or content
- `notion-create-pages` — create new tasks in the Tasks database

### Task Status Lifecycle

Tasks are subtasks of stories and have a simplified three-state lifecycle:

```
TODO → In Progress → Done
```

Stories, epics, and milestones keep the full lifecycle: `TODO → In Progress → In Review → In Test → Done`.

#### Starting work (`TODO` → `In Progress`)

- When starting work on a story, move **ALL tasks** in the story to `In Progress` **immediately** — including during planning, not just coding.
- Also move the **story**, its parent **epic**, and the parent **milestone** to `In Progress` (if they are in `TODO` or `Not Started`).
- **Do not skip updating tasks.** Every task must be marked `In Progress` before any planning or coding begins.

#### Finishing work (`In Progress` → `Done`)

- Always push finished work to a **feature branch**, never directly to `main`.
- After pushing, **wait for CI checks to pass**. Only move the task to `Done` once checks are green.
- If **all tasks** for the parent story are `Done`, move the **story** to `In Review` (the PR is ready for review).

#### Story lifecycle (cascades from tasks)

- **Story → In Review**: all tasks are `Done` (PR open, ready for review).
- **Story → In Test**: PR merged into `main`.
- **Epic → In Review**: all stories are in `In Test` or `Done`.
- **Never** move stories, epics, or milestones to `Done`/`Completed`. That is done manually by the user.

## Git Conventions

- Never add `Co-Authored-By`, `Generated-By`, or any AI attribution footers to commit messages.
- **Never commit to or push to an old/existing feature branch** when working on a new story. Always create a fresh branch from `main`.
- Before every commit, run `pnpm format` to format/lint and `pnpm codegen` to regenerate any generated code. Stage any resulting changes before committing.
- When fixing biome-fixable errors, always use `pnpm format`.
- After every `git push`, check that CI pipelines pass (`gh run list`, `gh run view`). If a workflow fails, investigate the logs, fix the issue, and push again until all checks are green.

## Internationalization (i18n)

### Supported Locales

- **English (`en`)** — source language (base locale)
- **Czech (`cs`)**

### Framework: Paraglide JS v2

Paraglide compiles translations into typed `m.key()` functions at build time. Missing keys fail the build. Unused translations are tree-shaken.

- **Vite plugin**: `paraglideVitePlugin` from `@inlang/paraglide-js` in `applications/web/vite.config.ts`
- **Project config**: `applications/web/project.inlang/settings.json`
- **Generated code**: `applications/web/src/paraglide/` (auto-generated, gitignored)

### Translation Files

JSON files at `applications/web/messages/{locale}.json`:
- `messages/en.json` — English (source)
- `messages/cs.json` — Czech

Key format: `snake_case` with `_` separating hierarchy levels (e.g., `profile_complete_title`).

Parameterized strings use `{variable}` syntax: `"auth_signedInAs": "Signed in as {username}"`.

### Adding New Translations

1. Add the key + English text to `messages/en.json`
2. Add the Czech translation to `messages/cs.json`
3. Import and call in components:
   ```typescript
   import * as m from '../paraglide/messages.js';
   // or: import { m } from '../paraglide/messages.js';
   <p>{m.my_new_key({ param: value })}</p>
   ```
4. Run `pnpm codegen` (from `applications/web/` or repo root) before committing — the CI `Build` job runs codegen and fails if the generated paraglide files are stale
5. The Vite plugin regenerates types on save — IDE autocomplete works immediately

### Locale Persistence

- **Authenticated users**: `locale` column on `users` table (`VARCHAR(5) NOT NULL DEFAULT 'en'`). Updated via `PATCH /auth/me/locale`.
- **Unauthenticated users**: Paraglide uses `localStorage` key `PARAGLIDE_LOCALE` (default strategy).
- **Root route** (`__root.tsx`): On load, if user is authenticated, calls `setLocale(user.locale)` to sync Paraglide with the server-stored preference.

### Locale Runtime API

```typescript
import { getLocale, setLocale } from '../paraglide/runtime.js';

getLocale();      // Returns current locale: 'en' | 'cs'
setLocale('cs');   // Switches locale
```

### Date Formatting

The `useFormatDate` hook (`applications/web/src/hooks/useFormatDate.ts`) provides locale-aware formatting via the browser's `Intl` API:

```typescript
const { formatDate, formatTime, formatDateTime, formatRelative } = useFormatDate();
formatDate(new Date());     // "17. února 2026" (cs) or "February 17, 2026" (en)
formatRelative(someDate);   // "před 3 dny" (cs) or "3 days ago" (en)
```

### Language Switcher

`LanguageSwitcher` organism (`applications/web/src/components/organisms/LanguageSwitcher.tsx`) uses the `LocaleSelect` molecule (Shadcn Select wrapper). Accepts `isAuthenticated` prop — when `true`, persists choice to server via the `updateLocale` API. Uses `useRun()` internally.

### Bot Localization

Discord's built-in `description_localizations` field on command definitions provides Czech translations. For dynamic response text, use the `Interaction` context tag from `dfx/Interactions/index` to read `guild_locale` (server language) or `locale` (user language):

```typescript
import { Interaction } from 'dfx/Interactions/index';

Interaction.pipe(
  Effect.map((i) => {
    // APIPingInteraction omits `locale`, so narrow with `in` before accessing
    const rawLocale = i.guild_locale ?? ('locale' in i ? i.locale : undefined);
    const locale = (rawLocale ?? 'en').startsWith('cs') ? 'cs' : 'en';
    return Ix.response({
      type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: locale === 'cs' ? 'Pong! Bot žije.' : 'Pong!' },
    });
  }),
)
```

Prefer `guild_locale` (server-configured language) over `locale` (individual user's language) for server-wide consistency.

## Discord Sync Architecture

The bot and server communicate via an **event-driven polling pattern** for syncing Discord resources. The server emits events into database tables; the bot polls every 5 seconds via RPC and processes them.

### RPC Transport

All sync RPCs share a single `RoleSyncRpcs` group served at `/rpc/role-sync` (NDJSON over HTTP). This avoids RPC protocol conflicts in the bot — a single `RpcClient.Protocol` layer can't serve two URLs, so both role sync and channel sync RPCs live in the same group.

- **Domain**: `packages/domain/src/rpc/RoleSyncRpc.ts` — RPC definitions (schemas + group)
- **Server**: `applications/server/src/rpc/RoleSyncRpcLive.ts` — RPC handler implementations
- **Bot**: Both `RoleSyncService` and `ChannelSyncService` create clients via `RpcClient.make(RoleSyncRpcs)`

### Role Sync (roles ↔ Discord roles)

Syncs team roles to Discord guild roles. When roles are created/deleted/assigned/unassigned, the server emits events to `role_sync_events`.

| Component | File |
|-----------|------|
| Events table | `role_sync_events` (migration: `1740970000_create_role_sync.ts`) |
| Mapping table | `discord_role_mappings` (team_id + role_id → discord_role_id) |
| Domain model | `packages/domain/src/models/RoleSyncEvent.ts` |
| Server repo | `applications/server/src/repositories/RoleSyncEventsRepository.ts` |
| Mapping repo | `applications/server/src/repositories/DiscordRoleMappingRepository.ts` |
| Bot service | `applications/bot/src/services/RoleSyncService.ts` |
| API integration | `applications/server/src/api/role.ts` |

Event types: `role_created`, `role_deleted`, `role_assigned`, `role_unassigned`

### Channel Sync (subgroups ↔ Discord channels)

Syncs subgroups to private Discord text channels. When subgroups are created/deleted or members added/removed, the server emits events to `channel_sync_events`. The bot creates private channels (denying `@everyone` VIEW_CHANNEL+SEND_MESSAGES) and manages per-user permission overwrites.

| Component | File |
|-----------|------|
| Events table | `channel_sync_events` (migration: `1741000000_create_channel_sync.ts`) |
| Mapping table | `discord_channel_mappings` (team_id + subgroup_id → discord_channel_id) |
| Domain model | `packages/domain/src/models/ChannelSyncEvent.ts` |
| Server repo | `applications/server/src/repositories/ChannelSyncEventsRepository.ts` |
| Mapping repo | `applications/server/src/repositories/DiscordChannelMappingRepository.ts` |
| Bot service | `applications/bot/src/services/ChannelSyncService.ts` |
| API integration | `applications/server/src/api/subgroup.ts` |

Event types: `channel_created`, `channel_deleted`, `member_added`, `member_removed`

### Sync Pattern (applies to both)

1. **Server** API handler performs the primary operation (e.g. insert subgroup)
2. **Server** calls `repo.emitIfGuildLinked(teamId, eventType, ...)` — looks up `guild_id` from `teams` table; if linked, inserts an event row; if not, no-op
3. Event emission is wrapped in `Effect.catchAll(() => Effect.void)` so sync failures never break the primary operation
4. **Bot** service polls via `rpc.GetUnprocessed*Events({ limit: 50 })` every 5 seconds
5. **Bot** processes each event (Discord REST calls with exponential retry), then marks processed or failed
6. Mapping tables track the Discord resource ID (role/channel) for each domain entity

### Adding a New Sync Type

Follow the same pattern:
1. Create migration with `*_sync_events` and `discord_*_mappings` tables
2. Add domain models in `packages/domain/src/models/`
3. Add RPC schemas and endpoints to `RoleSyncRpc.ts` (same group)
4. Rebuild domain: `pnpm build` in `packages/domain`
5. Create server repositories following `RoleSyncEventsRepository` pattern
6. Add RPC handlers to `RoleSyncRpcLive.ts`
7. Wire repositories in `applications/server/src/AppLive.ts`
8. Emit events from the relevant API handler
9. Create bot service following `RoleSyncService` pattern
10. Wire bot service in `AppLive.ts`, `Bot.ts`, `index.ts`
11. Add `MockChannelSyncEventsRepository` (or equivalent) to all server test files

## Frontend Architecture (`applications/web`)

### Component Structure — Atomic Design

Components live in `applications/web/src/components/` and are organized following **Atomic Design**:

```
components/
├── ui/          — Shadcn/UI primitives (auto-generated, do not hand-edit)
├── atoms/       — Smallest self-contained components (e.g. LanguageSwitcher)
├── molecules/   — Combinations of atoms (e.g. FormField = Label + Input)
├── organisms/   — Complex, multi-responsibility sections (e.g. ProfileCompleteForm)
├── pages/       — Full page components, one per route (e.g. HomePage, DashboardPage)
└── layouts/     — Structural wrappers/shells (e.g. RootDocument)
```

#### Layer guidelines

| Layer | Rule |
|-------|------|
| `ui/` | Shadcn primitives only. Added via `pnpm -C ./applications/web dlx shadcn@latest add <component>`. Never hand-edited. |
| `atoms/` | Single responsibility, no business logic, no API calls. |
| `molecules/` | Compose atoms + ui. No route-level data fetching, no API calls. |
| `organisms/` | May own significant local state, form logic, or API calls via `useRun()` (e.g. `LanguageSwitcher`, `ProfileCompleteForm`). No TanStack Router hooks. |
| `pages/` | One file per route. Receives data from `Route.useLoaderData()` / `Route.useRouteContext()` via props. Contains navigation callbacks. |
| `layouts/` | Pure structural wrappers. Render `{children}` slots. No business logic. |

#### Route file convention

Route files (`routes/**/*.tsx`) contain TanStack Router config (`createFileRoute`, `beforeLoad`, `loader`, `validateSearch`) plus a thin wrapper component that calls `Route.use*()` hooks and passes the results as props to the Page component. The Page component itself has no TanStack Router dependency.

```typescript
// routes/(authenticated)/dashboard.tsx
export const Route = createFileRoute('/(authenticated)/dashboard')({
  component: DashboardRoute,
  beforeLoad: ...,
  loader: ...,
});

function DashboardRoute() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  return <DashboardPage user={user} data={data} />;
}
```

```typescript
// components/pages/DashboardPage.tsx
export function DashboardPage({ user, data }: DashboardPageProps) {
  // No Route.use*() calls — pure component driven by props
}
```

#### Route file naming (TanStack Router)

Routes use a **hybrid directory + flat-file** layout. Top-level groupings (`profile/`, `teams/$teamId/`) are directories; sub-pages within them stay flat (dot-separated). The critical distinction is between **layout files**, **index files**, and **plain route files**:

| File | Resolves to | Purpose |
|------|------------|---------|
| `profile/index.tsx` | `/profile` | **Index page** (has sibling sub-routes) |
| `profile/complete.tsx` | `/profile/complete` | **Page** |
| `teams/index.tsx` | `/teams` | **Index page** (has sibling sub-routes) |
| `teams/$teamId/index.tsx` | `/teams/:teamId` | **Index page** (has sibling sub-routes, e.g. `members.index.tsx`) |
| `teams/$teamId/members.index.tsx` | `/teams/:teamId/members` | **Index page** (has sibling `members.$memberId`) |
| `teams/$teamId/members.$memberId.tsx` | `/teams/:teamId/members/:memberId` | **Page** |
| `notifications.tsx` | `/notifications` | **Plain route** (no sub-routes, so no `.index`) |

**Key rules:**
- Use `.index.tsx` only when the route has sibling sub-routes sharing the same prefix (e.g. `members.index.tsx` + `members.$memberId.tsx`). If a route has no sub-routes, use a plain `.tsx` file instead.
- When a route has sub-routes, the parent route file is a **layout** — it wraps children via `<Outlet />`. The actual page at that path must be `index.tsx`.

Current route structure:
```
routes/(authenticated)/
├── route.tsx                      — layout wrapper (auth guard)
├── dashboard.tsx                  — /dashboard
├── notifications.tsx              — /notifications
├── profile/
│   ├── index.tsx                  — /profile
│   └── complete.tsx               — /profile/complete
└── teams/
    ├── index.tsx                  — /teams
    └── $teamId/
        ├── index.tsx              — /teams/:teamId
        ├── age-thresholds.tsx     — /teams/:teamId/age-thresholds
        ├── members.index.tsx      — /teams/:teamId/members
        ├── members.$memberId.tsx  — /teams/:teamId/members/:memberId
        ├── roles.index.tsx        — /teams/:teamId/roles
        ├── roles.$roleId.tsx      — /teams/:teamId/roles/:roleId
        ├── rosters.index.tsx      — /teams/:teamId/rosters
        ├── rosters.$rosterId.tsx  — /teams/:teamId/rosters/:rosterId
        ├── subgroups.index.tsx    — /teams/:teamId/subgroups
        └── subgroups.$subgroupId.tsx — /teams/:teamId/subgroups/:subgroupId
```

### Auth store — `lib/auth.ts`

`lib/auth.ts` wraps browser `localStorage` via `@effect/platform-browser` `BrowserKeyValueStore`. All auth functions return Effects with `never` error and `never` requirements (the `KeyValueStore` layer is provided internally, errors are caught).

```typescript
import { KeyValueStore } from '@effect/platform';
import { BrowserKeyValueStore } from '@effect/platform-browser';

const kvLayer = BrowserKeyValueStore.layerLocalStorage;

// Internal helpers — provide layer + catch errors
const get = (key: string) =>
  KeyValueStore.KeyValueStore.pipe(
    Effect.flatMap((store) => store.get(key)),
    Effect.provide(kvLayer),
    Effect.catchAll(() => Effect.succeed(Option.none<string>())),
  );

// Exported functions: Effect<..., never, never>
export const getLastTeamId = get(LAST_TEAM);
export const setLastTeamId = (teamId: string) => set(LAST_TEAM, teamId);
```

**In React callbacks / `useEffect`**: use `Effect.runSync(...)` since localStorage is synchronous:
```typescript
Effect.runSync(setLastTeamId(teamId));
const lastTeamId = Effect.runSync(getLastTeamId); // Option<string>
```

**In `beforeLoad` / `loader`**: pipe auth effects directly into the Effect chain (no `Effect.runSync`). See the `beforeLoad` pattern below.

### `beforeLoad` Effect pipe pattern

`beforeLoad` should be a single `Effect.Do` pipe ending with `context.run` — **not** an `async` function with `Effect.runSync` calls. Use tagged errors for early exits and `Redirect.make({...})` for navigation:

```typescript
class SkipError extends Data.TaggedError('SkipError') {}

beforeLoad: ({ search, context }) =>
  Effect.Do.pipe(
    Effect.tap(
      Option.match(Option.fromNullable(search.token), {
        onSome: finishLogin,
        onNone: () => Effect.void,
      }),
    ),
    Effect.tap(
      Option.match(context.userOption, {
        onSome: () => Effect.void,
        onNone: () => new SkipError(),
      }),
    ),
    Effect.flatMap(() => getPendingInvite),               // returns Option
    Effect.tap(() => clearPendingInvite),
    Effect.flatMap(
      Option.match({
        onSome: (code) => Redirect.make({ to: '/invite/$code', params: { code } }),
        onNone: () => Effect.void,
      }),
    ),
    Effect.flatMap(() => getLastTeamId),
    Effect.flatMap(
      Option.match({
        onSome: (teamId) => Redirect.make({ to: '/teams/$teamId', params: { teamId } }),
        onNone: () => Effect.void,
      }),
    ),
    // ... API calls, more redirects ...
    Effect.catchTag('SkipError', () => Effect.void),     // swallow early exits
    context.run,                                          // run the whole pipe
  ),
```

**Key conventions:**
- `SkipError` — custom tagged error for "stop processing, no redirect needed" (e.g. unauthenticated user)
- `Redirect.make({...})` — accepts type-safe `RedirectOptions` directly. Internally defers the `redirect()` call in a closure to avoid circular type inference with `createFileRoute`. `context.run` invokes the closure which throws for TanStack Router to handle.
- `Option.match({ onSome: ..., onNone: ... })` — branch on `Option` values from auth store / API calls
- No `async`/`await` or `Effect.runSync` — the entire `beforeLoad` is one `Effect.Do` pipe

### Runtime — Client vs Server runners

`lib/runtime.ts` exposes two distinct run functions:

| Function | Used in | Error channel | Returns | Side-effects |
|---|---|---|---|---|
| `runPromiseServer(url)(abortController?)` | `beforeLoad`, `loader` | `Redirect \| NotFound` | `Promise<A>` (throws on error) | None |
| `runPromiseClient(url)` | Root loader → `RunProvider` | `ClientError` | `Promise<Option<A>>` | Auto `toast.error` on failure |

**`Run` type** (what `useRun()` returns):
```typescript
type Run = <A>(
  effect: Effect.Effect<A, ClientError, ApiClient | ClientConfig>,
) => Promise<Option.Option<A>>;
```

**Wiring**: The root loader creates `runPromiseClient(url)` and passes it to `RootDocument` as the `run` prop, which puts it in `RunProvider`. All organisms access it via `useRun()` — no prop drilling of `makeRun`.

**`ClientError`** has a static factory: `ClientError.make(message)`.

**Organisms** call `useRun()` directly and pipe effects into `run`:
```typescript
const run = useRun();
await ApiClient.pipe(
  Effect.flatMap((api) => api.someEndpoint(...)),
  Effect.catchTag('SomeError', () => ClientError.make('Error message')),
  run, // toast.error shown automatically on ClientError
);
```

## Documentation Conventions

- **Always update AGENTS.md** when making architecture changes, adding new patterns, changing CI/build workflows, or establishing new conventions. This file is the single source of truth for how the codebase works.

---

**Last Updated**: 2026-03-02

When working on this codebase, prioritize type safety, composability, and Effect's functional patterns. Keep implementations simple and focused on the task at hand. Leverage Effect's powerful abstractions for error handling, resource management, and dependency injection.
