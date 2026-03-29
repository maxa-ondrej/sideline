# AGENTS.md

## Project Overview

This is an **Effect-TS monorepo** built with TypeScript, utilizing a modern functional programming approach. The project emphasizes type safety, composable effects, and structured concurrency through the Effect ecosystem.

### Architecture

```
applications/
├── bot/       — Discord bot (dfx, Effect-native)        → see applications/bot/AGENTS.md
├── server/    — HTTP API server (Effect + PostgreSQL)    → see applications/server/AGENTS.md
├── web/       — TanStack Start frontend (React 19, Vite) → see applications/web/AGENTS.md
└── proxy/     — Reverse proxy (nginx-like routing)
packages/
├── domain/    — Core domain models and API contracts     → see packages/domain/AGENTS.md
├── effect-lib/— Shared Effect utilities (Bind, Schemas)  → see packages/effect-lib/AGENTS.md
├── i18n/      — Translation system (Paraglide.js)        → see packages/i18n/AGENTS.md
└── migrations/— Database migrations (Effect SQL)         → see packages/migrations/AGENTS.md
```

Each application follows an **AppLive + run.ts** pattern:
- **`AppLive`** — a composable `Layer` that wires up the application's core services without runtime concerns (config, logging, connection details). This is the unit that can be tested or composed into larger systems.
- **`run.ts`** — the deployment entrypoint that provides environment-specific layers (PgClient, NodeHttpServer, Logger, Config) and calls `NodeRuntime.runMain`.

The **migrations** package exports `MigratorLive` — a layer that only needs a `PgClient` and filesystem. Consumers provide their own `PgClient`, keeping the migration package decoupled from connection config.

## Technology Stack

- **TypeScript 5.6+** — Strict mode, NodeNext module resolution, ES2022 target
- **Effect-TS 3.10+** — Functional effect system for composable, type-safe programs
- **pnpm** — Fast, disk-efficient package manager (workspace-aware). Always use bare `pnpm` command, never `npx pnpm@...`
- **Vitest 3.2+** — Testing framework with Effect integration (`@effect/vitest`)
- **Biome.js** — Fast linting and formatting
- **Changesets** — Version management and changelog generation
- **Husky + lint-staged** — Pre-commit hooks (auto-format via biome)

## Effect-TS Patterns

### The Effect Type

```typescript
Effect<Success, Error, Requirements>
```

- `Success (A)` — The value type on success
- `Error (E)` — The error type(s) that can occur
- `Requirements (R)` — Services/dependencies needed to run

**Key Principle**: Effects are **blueprints**, not imperative actions. They describe programs that the runtime executes.

### Dependency Injection

Use **covariant union types** (not intersections) for services:

```typescript
class DatabaseService extends Effect.Tag("DatabaseService")<
  DatabaseService,
  { query: (sql: string) => Effect.Effect<Result> }
>() {}

// Dependencies merge as R = DatabaseService | CacheService
```

### Service Patterns

- Use `Effect.Tag` for service definitions with static method access
- Use `Layer` for service construction and dependency wiring
- Use `ManagedRuntime` for service lifecycle in external frameworks
- Prefer `Effect.provide` over manual dependency passing

### Configuration

```typescript
import { Config } from "effect"
const dbUrl = Config.string("DATABASE_URL")
const port = Config.number("PORT").pipe(Config.withDefault(3000))
const apiKey = Config.redacted("API_KEY")
```

### Error Handling

Typed errors automatically merge into unions. Handle specific errors with `Effect.catchTag`.

### Resource Management

Use `Effect.acquireRelease` for automatic resource cleanup.

## Code Style

- **Never use `Effect.gen(function* () {`** — instead use `Effect.Do.pipe(...)` with `Effect.bind` / `Effect.let` / `Effect.tap`
- **Use `pipe`** for linear transformations and chaining
- **Always use `Effect.asVoid`** instead of `Effect.map(() => undefined)`
- **Never cast types** (`as X`) and **never use `any`**
- **Never use `Schema.optional`** — always use `Schema.optionalWith({ as: 'Option' })` or `Schema.OptionFromNullOr(...)`
- **Use `Schema.OptionFromNullOr`** for nullable API/DB fields
- **Use branded types** (e.g. `Discord.Snowflake`, `Team.TeamId`) instead of raw `Schema.String` for IDs
- **Use `Effect.void`** instead of `Effect.succeed(undefined)` or `Effect.unit`
- **Use Effect `Array` module** instead of native JS array methods in Effect pipelines
- **Type narrow errors** — use discriminated unions for error types

### Import Conventions

```typescript
// Use .js extensions in imports (TypeScript + ESM)
import { pipe } from "effect"
import * as Effect from "effect/Effect"

// Workspace imports
import { DomainService } from "@sideline/domain"
```

### Path Aliases

```typescript
@sideline/bot        → ./applications/bot/src
@sideline/domain     → ./packages/domain/src
@sideline/server     → ./applications/server/src
```

## Testing

### Test Structure

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

### Test Utilities

- **`it.effect`** — Run Effect programs as tests
- **`it.scoped`** — Tests requiring scope
- **`it.live`** — Tests with live services
- **`TestClock`** — Control time
- **`ConfigProvider.fromMap`** — Mock configuration
- **`Effect.provide`** — Supply test implementations

### Running Tests

```bash
pnpm test                    # Run all tests
pnpm test --watch            # Watch mode
cd packages/domain && pnpm test  # Specific package
```

## E2E Testing

E2E tests live in the `e2e/` directory at the monorepo root and use **Playwright**.

### Structure

```
e2e/
├── playwright.config.ts   — Playwright configuration (baseURL, projects, webServer)
├── tsconfig.json          — Standalone tsconfig for e2e tests
└── tests/
    └── *.spec.ts          — Test files (use .spec.ts extension)
```

### Writing E2E Tests

```typescript
import { expect, test } from '@playwright/test';

test.describe('Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Sideline/);
  });
});
```

### Running E2E Tests

```bash
pnpm test:e2e              # Run E2E tests (starts dev server automatically)
pnpm test:e2e:ui           # Open Playwright UI mode for debugging
pnpm exec playwright install chromium  # Install browser (first-time setup)
```

The `webServer` config in `playwright.config.ts` automatically starts `pnpm --filter @sideline/web dev` when running tests locally. In CI, `reuseExistingServer` is disabled so Playwright always manages the server lifecycle.

## Package Structure Conventions

```
packages/{name}/
├── src/
│   ├── index.ts           — Main entry point (must export public API)
│   ├── {Feature}/         — Feature-based organization
│   │   ├── services.ts    — Effect services
│   │   ├── models.ts      — Domain models (Effect Schema)
│   │   ├── effects.ts     — Effect programs
│   │   └── layers.ts      — Layer construction
├── test/
│   └── *.test.ts          — Test files
├── package.json
├── tsconfig.json
├── tsconfig.src.json
├── tsconfig.test.json
└── tsconfig.build.json
```

## Common Tasks

```bash
pnpm build               # Build all packages
pnpm check               # Type check
pnpm test                # Run tests
pnpm test:e2e            # Run Playwright E2E tests
pnpm test:e2e:ui         # Open Playwright UI mode
pnpm format              # Biome formatting and linting
pnpm codegen             # Regenerate generated code
pnpm clean               # Remove stale artifacts
pnpm tsx ./path/to/file.ts   # Execute TypeScript directly
```

## Biome.js

- **Formatter**: 2-space indentation, 100-char line width, single quotes, semicolons, trailing commas
- **Linter**: All recommended rules + TypeScript-specific rules
- **Import Organization**: Automatic import sorting, unused import removal
- **VCS Integration**: Git-aware, respects `.gitignore`
- **Test File Overrides**: `noExplicitAny` disabled in test files

## CI Pipeline

The `check.yml` workflow runs on pushes to `main` and on pull requests:

| Job | Command | Purpose |
|-----|---------|---------|
| **Lint & Format** | `pnpm lint` | Biome formatting and lint rules |
| **Build** | `pnpm codegen && pnpm build` | Verifies codegen + builds all packages |
| **Types** | `pnpm check` | Type-checks all packages |
| **Test** | `pnpm build && pnpm test` | Builds packages, then runs tests |
| **E2E Tests** | `pnpm build && pnpm test:e2e` | Builds packages, then runs Playwright E2E tests |

> **Why Build is critical:** Workspace packages use `publishConfig.directory: "dist"`, so pnpm symlinks consumers to `packages/*/dist`. Stale `.d.ts` files cause false type errors and cryptic test failures. **Always rebuild `packages/domain` after changing domain source files.**

### Docker / Snapshot Pipeline

`snapshot.yml` runs on PRs: publishes package snapshots via `pkg-pr-new`, builds Docker images for all apps, pushes to `ghcr.io/maxa-ondrej/sideline/<app>`.

### Full Clean Verification

When type errors seem wrong or after large refactors:
```bash
pnpm codegen && pnpm build && find . -name '*.tsbuildinfo' -delete && pnpm check && pnpm test
```

## Branching & PR Strategy

Trunk-based development on `main`:
- **`main`** is the single long-lived branch
- **Feature branches** branch off `main` and merge back via PR
- Branch naming: `feat/rsvp-buttons`, `fix/auth-token-refresh`, `docs/setup-guide`

### Workflow

1. Create a feature branch from `main`
2. Make changes, commit (pre-commit hooks run biome automatically)
3. Open a PR against `main` — CI runs checks + snapshot build
4. After review, squash-merge into `main`
5. For publishable changes, add a changeset before merging

## Development Workflow Skills

The development workflow is split into composable skills:

| Skill | Purpose |
|-------|---------|
| `/work` | Orchestrator: picks up a Notion story → `/implement` → `/ship` → updates Notion |
| `/implement` | Full dev loop: research → plan → TDD → verify tests → implement → verify → review → refactor |
| `/ship` | Delivery loop: changeset → checks → commit → push → PR → CI → code review → `/revise` |
| `/revise` | Triage review comments with `/architect` → `/implement` fixes → `/ship` |
| `/refactor` | Refactor code with before/after explanation, verified by tests |
| `/complete` | Mark story/bug as done after PR is merged (story → Done, bug → Fixed) |
| `/reconcile` | Sync Notion statuses for merged PRs |

### Composition

- **`/work`** calls `/implement` then `/ship` — use for full story lifecycle with Notion integration
- **`/implement`** is standalone — use when you already have a branch and want the full dev loop
- **`/ship`** is standalone — use when code is ready and you want to commit, push, and handle review
- **`/revise`** is standalone — use when a PR has review comments to address
- **`/complete`** is standalone — use after a PR is merged to finalize Notion statuses

## Version Management

```bash
pnpm changeset             # Create a changeset
pnpm changeset-version     # Version packages based on changesets
pnpm changeset-publish     # Build, test, and publish
```

### Changeset Bump Rules

- **patch** — small features, bug fixes, refactors
- **minor** — larger features, significant new functionality
- **major** — never bump major
- Include all `@sideline/*` packages with meaningful code changes

## Git Conventions

- Never add `Co-Authored-By`, `Generated-By`, or any AI attribution footers to commit messages
- Never commit to an old/existing feature branch when working on a new story — always create fresh from `main`
- Before every commit, run `pnpm format` and `pnpm codegen`, stage resulting changes
- After every `git push`, check that CI pipelines pass
- After any structural change (new packages, new patterns, changed conventions), update the relevant section in AGENTS.md as part of the same PR

## Task Management (Notion)

**Always use the `notion` CLI tool to check for tasks, stories, and sprint work.** Notion is the single source of truth.

### Hierarchy

```
Milestone → Epic → Story → Task
```

### Notion Databases

| Database | ID |
|----------|---|
| Tasks | `2e0b6b31-d3bd-4e32-a127-3eedf257f228` |
| Stories | `9ec44d56-966b-4c3e-ba98-637b128c99a8` |
| Epics | `a040ab6d-10bb-4575-8c80-d4e827238b03` |
| Milestones | `089dd440-070c-4cfb-a45d-1a68c299a2f2` |
| Sprints | `a89cc7a7-ab1a-4e3f-945d-d42028c75f00` |
| Bugs | `e6b8eb47-ddcd-4dba-b5fd-c631763ac5bd` |

### Task Properties

- **Status** — `TODO` | `In Progress` | `Done`
- **Type** — Feature | Bug | Design | Test | Docs | DevOps | Refactor
- **Story** — relation to Stories database
- **Version** — `v1` | `v2`

### Task Status Lifecycle

Tasks: `TODO → In Progress → Done`
Stories/epics/milestones: `TODO → In Progress → In Review → In Test → Done`

- When starting work, move **ALL tasks** to `In Progress` immediately
- Also cascade `In Progress` up to story, epic, milestone
- After CI passes, move tasks to `Done`; if all tasks done, story → `In Review`
- After PR merged, story → `In Test`
- **Never** move stories/epics/milestones to `Done` — that's manual

### Notion CLI (`notion`)

Use the `notion` CLI tool (installed via `brew install 4ier/tap/notion-cli`) for all Notion operations:

```bash
notion db query <db-id> -f json --all          # query database
notion db query <db-id> -F "Status=Done"       # filter
notion page props <page-id> -f json            # read properties
notion page view <page-id> -f md               # read page body
notion page set <page-id> "Status=In Progress" # update property
notion search "keyword" -f json                # search
```

## Preview Database Access

Each PR gets a preview database. Use `bin/psql` to connect:

```bash
psql --pr 108                          # Connect to PR 108's preview database
psql --pr 108 -c "SELECT * FROM teams" # Run a query
psql                                   # Connect to the main preview database
```

Configuration:
- `.env.preview` — connection config (host, port, user, DB name templates) — committed
- `.env.preview.local` — password only — gitignored

Both files are sourced automatically by `bin/psql`. The `bin/` directory is added to `PATH` via `.envrc`.

## Logs & Monitoring

Logs, traces, and metrics are exported via OpenTelemetry to **SigNoz**. The telemetry layer is configured in each application's `run.ts` using `makeTelemetryLayer` from `@sideline/effect-lib`.

### Services

| Application | `service.name` |
|-------------|----------------|
| Server | `sideline-server` |
| Bot | `sideline-bot` |

### Resource Attributes

| Attribute | Source | Example |
|-----------|--------|---------|
| `service.name` | `OTEL_SERVICE_NAME` | `sideline-server` |
| `deployment.environment` | `APP_ENV` | `preview` |
| `service.origin` | `APP_ORIGIN` | `sideline-preview.majksa.net` |

### Querying Logs

When searching logs in SigNoz, always filter by resource attributes for faster queries:

- `service.name = 'sideline-server'` — scope to a specific service
- `deployment.environment = 'preview'` — scope to an environment
- Severity levels: `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`

## Troubleshooting

- **"Cannot find module"**: Ensure `.js` extensions in imports, run `pnpm install`
- **Type errors with Effect**: Ensure `@effect/language-service` is loaded, check error types are handled
- **Test failures**: Verify all services provided, use `it.effect` not raw `it`
- **Build failures**: Run `pnpm clean`, check `tsconfig.build.json`, verify project references
- **Stale domain `dist/`**: Run `pnpm build`, delete `.tsbuildinfo` files
- **TanStack Router serialization errors**: Add `ssr: false` to route options

## Documentation Conventions

- **Always update the relevant AGENTS.md** when making architecture changes, adding new patterns, or establishing new conventions
- Package-specific docs go in the package's `AGENTS.md`, not here

### Technical Documentation (`docs/`)

The `docs/` directory contains comprehensive technical documentation. These must stay in sync with the codebase. Update them as part of the same PR when making relevant changes:

| Document | Update when… |
|----------|-------------|
| `index.md` | Adding or removing documentation files |
| `discord-bot.md` | Adding/removing/renaming bot slash commands, button/modal interactions, gateway handlers, or RPC sync workers |
| `deployment.md` | Changing environment variables, Docker configuration, CI/CD pipelines, cron job schedules, monitoring setup, or local dev prerequisites |
| `api.md` | Adding/removing/renaming API endpoints, changing request/response schemas, adding new error types, or modifying auth requirements |
| `database.md` | Adding/removing/renaming database tables or columns (new migrations), changing constraints, indexes, or seeding behavior |

## Thesis Documentation (`docs/thesis/`)

The `docs/thesis/` directory contains Mermaid diagrams and documentation for the bachelor's thesis. These must stay in sync with the codebase. Update them as part of the same PR when making relevant changes:

| Document | Update when… |
|----------|-------------|
| `er-diagram.md` | Adding/removing/renaming database tables or columns (new migrations) |
| `architecture.md` | Adding new applications, packages, services, cron jobs, or changing the deployment topology (docker-compose, nginx) |
| `use-cases.md` | Adding new API endpoints, RPC methods, bot commands, or changing actor permissions |
| `sequence-diagrams.md` | Changing the flow of any documented interaction (OAuth, event creation, RSVP, role sync, cron generation, team creation, invites) |
| `user-testing-plan.md` | Adding or removing user-facing features that should be covered by test scenarios |
| `competitive-analysis.md` | Adding major new features that change Sideline's competitive positioning |

---

**Last Updated**: 2026-03-28
