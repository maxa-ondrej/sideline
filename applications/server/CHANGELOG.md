# @sideline/server

## 0.3.0

### Minor Changes

- [#35](https://github.com/maxa-ondrej/sideline/pull/35) [`eed4aa3`](https://github.com/maxa-ondrej/sideline/commit/eed4aa3820c6bbad12ff2292bcc92aee5a7460b9) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add Discord role sync via @effect/rpc: server emits role change events, bot polls and syncs to Discord

### Patch Changes

- Updated dependencies [[`eed4aa3`](https://github.com/maxa-ondrej/sideline/commit/eed4aa3820c6bbad12ff2292bcc92aee5a7460b9)]:
  - @sideline/domain@0.3.0
  - @sideline/migrations@0.3.0

## 0.2.0

### Minor Changes

- [#25](https://github.com/maxa-ondrej/sideline/pull/25) [`11b920c`](https://github.com/maxa-ondrej/sideline/commit/11b920c61ae409100c9bf09221a23929fdf053ef) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add admin roster management: team admins can view, edit, and deactivate team members. Adds `active` flag to team_members, roster API endpoints, and `myTeams` auth endpoint.

- [#27](https://github.com/maxa-ondrej/sideline/pull/27) [`780bca9`](https://github.com/maxa-ondrej/sideline/commit/780bca9d0300030fafd76edc3efd81e5f7a6f88d) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Support multiple roles per team member via junction table, with API endpoints to assign and unassign roles

- [#26](https://github.com/maxa-ondrej/sideline/pull/26) [`2b1f4b4`](https://github.com/maxa-ondrej/sideline/commit/2b1f4b460b2d234f026cf658a6b0651f84ef58a9) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add roles and permissions system replacing simple admin/member text role with granular permission-based authorization

- [#25](https://github.com/maxa-ondrej/sideline/pull/25) [`11b920c`](https://github.com/maxa-ondrej/sideline/commit/11b920c61ae409100c9bf09221a23929fdf053ef) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add proper Roster entity with many-to-many team member membership

  Teams can now have multiple named rosters (e.g. per-event). Each roster has a name, active flag, and a set of team members. New API endpoints for full roster CRUD plus add/remove member operations. Player-pool endpoints renamed from /roster/_ to /members/_.

- [#29](https://github.com/maxa-ondrej/sideline/pull/29) [`e8fd1ab`](https://github.com/maxa-ondrej/sideline/commit/e8fd1ab2e0b47aa37fa6ed58e01572d25f90e64d) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add subgroups — named groups of team members with associated permissions for fine-grained access control

### Patch Changes

- [`3a69cab`](https://github.com/maxa-ondrej/sideline/commit/3a69cab1968364b9208a0c04c8f7b6dc85ab36f6) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add extensive step-by-step logging to the Discord OAuth callback to diagnose auth failures. Logs each stage: callback received, state decoded, token exchange, Discord REST client, getMyUser result, DB upsert, and session creation. ErrorResponse and RatelimitedResponse from the Discord API now log the full error before returning the auth_failed redirect.

- [#26](https://github.com/maxa-ondrej/sideline/pull/26) [`2b1f4b4`](https://github.com/maxa-ondrej/sideline/commit/2b1f4b460b2d234f026cf658a6b0651f84ef58a9) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add createTeam API endpoint allowing authenticated users to create new teams from the web app

- [#25](https://github.com/maxa-ondrej/sideline/pull/25) [`11b920c`](https://github.com/maxa-ondrej/sideline/commit/11b920c61ae409100c9bf09221a23929fdf053ef) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix RosterWithCount schema to decode pg Date objects correctly using Model.DateTimeFromDate

- Updated dependencies [[`11b920c`](https://github.com/maxa-ondrej/sideline/commit/11b920c61ae409100c9bf09221a23929fdf053ef), [`2b1f4b4`](https://github.com/maxa-ondrej/sideline/commit/2b1f4b460b2d234f026cf658a6b0651f84ef58a9), [`780bca9`](https://github.com/maxa-ondrej/sideline/commit/780bca9d0300030fafd76edc3efd81e5f7a6f88d), [`2b1f4b4`](https://github.com/maxa-ondrej/sideline/commit/2b1f4b460b2d234f026cf658a6b0651f84ef58a9), [`11b920c`](https://github.com/maxa-ondrej/sideline/commit/11b920c61ae409100c9bf09221a23929fdf053ef), [`e8fd1ab`](https://github.com/maxa-ondrej/sideline/commit/e8fd1ab2e0b47aa37fa6ed58e01572d25f90e64d)]:
  - @sideline/domain@0.2.0
  - @sideline/migrations@0.2.0

## 0.1.7

### Patch Changes

- [#21](https://github.com/maxa-ondrej/sideline/pull/21) [`fa51b42`](https://github.com/maxa-ondrej/sideline/commit/fa51b42bab5144cc6027a9fafbc5e8b75271df90) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Standardize TypeScript imports to use `~` alias for `src/` and root-only package imports

- Updated dependencies [[`fa51b42`](https://github.com/maxa-ondrej/sideline/commit/fa51b42bab5144cc6027a9fafbc5e8b75271df90)]:
  - @sideline/domain@0.1.2
  - @sideline/effect-lib@0.0.2

## 0.1.6

### Patch Changes

- [`0685679`](https://github.com/maxa-ondrej/sideline/commit/06856798d01a669df8ac7ec38b64aca076e2b888) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Split migrations into before/after lifecycle, decompose DATABASE_URL into individual connection params, and update docker-compose for full-stack deployment.

## 0.1.5

### Patch Changes

- [`894c836`](https://github.com/maxa-ondrej/sideline/commit/894c836d65dc885a94d25d4f280c04c74b4866d0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Simplify version extraction in Docker release workflow

## 0.1.4

### Patch Changes

- [`79f2e9e`](https://github.com/maxa-ondrej/sideline/commit/79f2e9e7271e5ab82acdcff1b72f2e2a3b77f59f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix Docker build: add BuildKit setup and version-based image tags

## 0.1.3

### Patch Changes

- [`e1389ba`](https://github.com/maxa-ondrej/sideline/commit/e1389ba855a70a285581639d349908570456659c) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Build and push Docker images for changed applications as part of the release workflow

## 0.1.2

### Patch Changes

- [`8505070`](https://github.com/maxa-ondrej/sideline/commit/850507079ac8e4a9846a34fc365b2c2714ecfa5b) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Enable changesets versioning and tagging for private application packages

- Updated dependencies [[`8505070`](https://github.com/maxa-ondrej/sideline/commit/850507079ac8e4a9846a34fc365b2c2714ecfa5b)]:
  - @sideline/domain@0.1.1
  - @sideline/effect-lib@0.0.1
  - @sideline/migrations@0.1.3

## 0.1.1

### Patch Changes

- [`e01e3d6`](https://github.com/maxa-ondrej/sideline/commit/e01e3d6d39f59f141794328b1f1a702933b36e74) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Move npm publish back to release workflow, keep publish workflow for Docker builds only

## 0.1.0

### Minor Changes

- [#5](https://github.com/maxa-ondrej/sideline/pull/5) [`0458277`](https://github.com/maxa-ondrej/sideline/commit/0458277c509fccaa36fefdc7f2d9a8e9833caa83) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add Czech + English i18n support with Paraglide JS, language switcher, persistent user locale, and locale-aware formatting

- [`6579f9e`](https://github.com/maxa-ondrej/sideline/commit/6579f9e28eaf8f5ea2ef9d388e092a7cf672198b) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Initial project setup

  - Add Discord OAuth login flow with session and user management
  - Add typed frontend runtime with ApiClient context and ClientError
  - Add env-aware runMain for bot and server (JSON logger in production, pretty logger in development)
  - Add Dockerfiles and Docker CI workflow for all applications
  - Migrate Vitest to root test.projects configuration
  - Refactor app layers into AppLive + run.ts pattern
  - Add Swagger UI and OpenAPI docs to server
  - Add shadcn/ui components to web app

- [#4](https://github.com/maxa-ondrej/sideline/pull/4) [`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add profile completion flow: migration for profile fields, API endpoint, form UI, and tests

- [#3](https://github.com/maxa-ondrej/sideline/pull/3) [`a89cf75`](https://github.com/maxa-ondrej/sideline/commit/a89cf758025d95caae8a98c4337e9679c8bf301e) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add teams, team invites, and profile completion flow

### Patch Changes

- [`8a9287b`](https://github.com/maxa-ondrej/sideline/commit/8a9287bca2a249267cf1133802c656e8c489d4cd) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Centralize environment variable validation with @t3-oss/env-core

- [#4](https://github.com/maxa-ondrej/sideline/pull/4) [`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Remove Effect.orDie, type casts, and Effect.die from production and test code; introduce @sideline/effect-lib with Bind.remove and Runtime helpers; narrow repository service types for type-safe mocking

- [#4](https://github.com/maxa-ondrej/sideline/pull/4) [`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix Discord OAuth Bearer token, improve invite safety, add Effect DevTools, and strengthen type safety

- [`2776ed6`](https://github.com/maxa-ondrej/sideline/commit/2776ed65f129a1206637332b94bdf64a9280cfeb) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Reorganize domain package into models/ and api/ subdirectories and refactor server repositories to use bind/let pattern

- Updated dependencies [[`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab), [`0458277`](https://github.com/maxa-ondrej/sideline/commit/0458277c509fccaa36fefdc7f2d9a8e9833caa83), [`6579f9e`](https://github.com/maxa-ondrej/sideline/commit/6579f9e28eaf8f5ea2ef9d388e092a7cf672198b), [`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab), [`2776ed6`](https://github.com/maxa-ondrej/sideline/commit/2776ed65f129a1206637332b94bdf64a9280cfeb), [`a89cf75`](https://github.com/maxa-ondrej/sideline/commit/a89cf758025d95caae8a98c4337e9679c8bf301e)]:
  - @sideline/domain@0.1.0
  - @sideline/migrations@0.1.0
