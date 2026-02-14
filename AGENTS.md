# AGENTS.md

## Project Overview

This is an **Effect-TS monorepo** built with TypeScript, utilizing a modern functional programming approach. The project emphasizes type safety, composable effects, and structured concurrency through the Effect ecosystem.

### Architecture

```
applications/
├── bot/       - Discord bot (dfx, Effect-native)
├── server/    - Server application and API endpoints
└── web/       - TanStack Start frontend (Vite, React 19)
packages/
├── domain/    - Core domain logic and business rules
└── migrations/- Database migrations
```

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

- **Prefer `Effect.gen`** for sequential operations (like async/await)
- **Use `pipe`** for linear transformations and chaining
- **Avoid premature abstraction** - keep solutions simple
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
pnpm check               # Type check without building
pnpm check-recursive     # Type check all packages individually
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

- **Formatter**: 2-space indentation, 100-char line width, double quotes, trailing commas
- **Linter**: All recommended rules enabled plus TypeScript-specific rules
- **Import Organization**: Automatic unused import removal via `noUnusedImports`
- **Type-aware Rules**: `useImportType`, `useExportType` for proper type imports
- **VCS Integration**: Git-aware, respects `.gitignore`

### Scripts

Available npm scripts for code quality:

```bash
pnpm format          # Check formatting (dry-run)
pnpm format:write    # Format and write changes
pnpm lint            # Lint files (dry-run)
pnpm lint:write      # Lint and apply safe fixes
pnpm biome:check     # Check both formatting and linting
pnpm biome:fix       # Fix all auto-fixable issues (recommended)
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
pnpm biome:fix

# Check specific files
pnpm biome check src/

# Format only (no linting)
pnpm format:write
```

## CI Pipeline

The `check.yml` workflow runs on pushes to `main` and on pull requests. It has four parallel jobs:

| Job             | Command           | Purpose                                          |
|-----------------|-------------------|--------------------------------------------------|
| **Lint & Format** | `pnpm biome:check` | Enforces formatting and lint rules via Biome     |
| **Build**       | `pnpm codegen`    | Verifies codegen output is committed and current |
| **Types**       | `pnpm check`      | Type-checks all packages with `tsc -b`           |
| **Test**        | `pnpm vitest`     | Runs all Vitest tests across the workspace       |

All jobs use the shared `.github/actions/setup` composite action (pnpm + Node.js install with caching).

### Running CI checks locally

```bash
pnpm biome:check           # Lint & format check
pnpm codegen && git diff --exit-code  # Verify codegen is up to date
pnpm check                 # Type check
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
- **Status** — `TODO` | `In Progress` | `In Review` | `In Test` | `Done`
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

When starting work on a task, update its status to `In Progress`. When done, move it to `In Review` or `In Test` as appropriate.

## Git Conventions

- Never add `Co-Authored-By`, `Generated-By`, or any AI attribution footers to commit messages.

---

**Last Updated**: 2026-02-14

When working on this codebase, prioritize type safety, composability, and Effect's functional patterns. Keep implementations simple and focused on the task at hand. Leverage Effect's powerful abstractions for error handling, resource management, and dependency injection.
