# Sideline

[![CI](https://github.com/maxa-ondrej/sideline/actions/workflows/check.yml/badge.svg)](https://github.com/maxa-ondrej/sideline/actions/workflows/check.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Effect](https://img.shields.io/badge/Effect--TS-3.10+-black?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQyIDAtOC0zLjU4LTgtOHMzLjU4LTggOC04IDggMy41OCA4IDgtMy41OCA4LTggOHoiLz48L3N2Zz4=)](https://effect.website)
[![pnpm](https://img.shields.io/badge/pnpm-10.14+-f69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Sports team management system with a Discord-first architecture. Built as a bachelor's thesis project.

**Website:** [sideline.cz](https://sideline.cz)

## Architecture

An Effect-TS monorepo with schema-driven API design:

```
applications/
  bot/       Discord bot (dfx, Effect-native)
  server/    HTTP API handlers, repositories, service layer
  web/       TanStack Start frontend (Vite, React 19, Nitro)
packages/
  domain/    Schema definitions, typed errors, HttpApi spec
  migrations/Database migrations (Effect SQL)
```

The **domain** package defines the API contract (`HttpApiGroup` + `Schema`) and **server** implements it via `HttpApiBuilder` — all sharing the same type-safe spec.

Each application separates its composable layer (`AppLive`) from its runtime entrypoint (`run.ts`), allowing clean dependency injection and Docker deployment.

## Getting Started

### Prerequisites

**Nix + direnv (recommended):**

```sh
direnv allow
```

This provisions Node.js, pnpm, and configures git hooks automatically.

**Manual:**

- [Node.js](https://nodejs.org/) 24+
- [pnpm](https://pnpm.io/) 10.14+

### Setup

```sh
pnpm install
```

### Development

```sh
# Type check
pnpm check

# Run tests
pnpm test

# Lint & format (auto-fix)
pnpm biome:fix

# Start the server
pnpm tsx ./applications/server/src/server.ts
```

### Build

```sh
pnpm build
```

### Docker

Each application has a multi-stage Dockerfile. Build images from the repo root:

```sh
docker build -f applications/bot/Dockerfile -t sideline-bot .
docker build -f applications/server/Dockerfile -t sideline-server .
docker build -f applications/web/Dockerfile -t sideline-web .
```

Images are automatically built and pushed to GHCR on pull requests via the Snapshot workflow.

## Tech Stack

| Category       | Tool                                                       |
|----------------|------------------------------------------------------------|
| Language       | TypeScript 5.6+ (strict mode)                              |
| Effect system  | [Effect-TS](https://effect.website) 3.10+                  |
| Package mgmt   | pnpm workspaces                                            |
| Testing        | Vitest + [@effect/vitest](https://effect.website)          |
| Linting        | [Biome](https://biomejs.dev)                               |
| CI/CD          | GitHub Actions + [Changesets](https://github.com/changesets/changesets) |

## Pre-commit Hooks

[husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) automatically run `biome check --write` on staged files before each commit.

## Further Reading

See [`AGENTS.md`](./AGENTS.md) for architecture details, Effect-TS patterns, coding conventions, CI pipeline, and version management.

## License

[MIT](./LICENSE)
