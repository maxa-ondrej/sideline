# @sideline/bot

## 0.1.4

### Patch Changes

- [`894c836`](https://github.com/maxa-ondrej/sideline/commit/894c836d65dc885a94d25d4f280c04c74b4866d0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Simplify version extraction in Docker release workflow

## 0.1.3

### Patch Changes

- [`79f2e9e`](https://github.com/maxa-ondrej/sideline/commit/79f2e9e7271e5ab82acdcff1b72f2e2a3b77f59f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix Docker build: add BuildKit setup and version-based image tags

## 0.1.2

### Patch Changes

- [`e1389ba`](https://github.com/maxa-ondrej/sideline/commit/e1389ba855a70a285581639d349908570456659c) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Build and push Docker images for changed applications as part of the release workflow

## 0.1.1

### Patch Changes

- [`8505070`](https://github.com/maxa-ondrej/sideline/commit/850507079ac8e4a9846a34fc365b2c2714ecfa5b) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Enable changesets versioning and tagging for private application packages

- Updated dependencies [[`8505070`](https://github.com/maxa-ondrej/sideline/commit/850507079ac8e4a9846a34fc365b2c2714ecfa5b)]:
  - @sideline/domain@0.1.1
  - @sideline/effect-lib@0.0.1

## 0.1.0

### Minor Changes

- [`6579f9e`](https://github.com/maxa-ondrej/sideline/commit/6579f9e28eaf8f5ea2ef9d388e092a7cf672198b) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Initial project setup

  - Add Discord OAuth login flow with session and user management
  - Add typed frontend runtime with ApiClient context and ClientError
  - Add env-aware runMain for bot and server (JSON logger in production, pretty logger in development)
  - Add Dockerfiles and Docker CI workflow for all applications
  - Migrate Vitest to root test.projects configuration
  - Refactor app layers into AppLive + run.ts pattern
  - Add Swagger UI and OpenAPI docs to server
  - Add shadcn/ui components to web app

### Patch Changes

- [#7](https://github.com/maxa-ondrej/sideline/pull/7) [`156389b`](https://github.com/maxa-ondrej/sideline/commit/156389b1ede03fb5922aaeebdf0a8ac1e6e402ee) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Bot ping command now responds in the server's configured language by reading `guild_locale` from the Discord interaction.

- [`8a9287b`](https://github.com/maxa-ondrej/sideline/commit/8a9287bca2a249267cf1133802c656e8c489d4cd) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Centralize environment variable validation with @t3-oss/env-core

- [#5](https://github.com/maxa-ondrej/sideline/pull/5) [`0458277`](https://github.com/maxa-ondrej/sideline/commit/0458277c509fccaa36fefdc7f2d9a8e9833caa83) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add dev scripts for watch-mode development; fix HealthServerLive port and log address

- [#5](https://github.com/maxa-ondrej/sideline/pull/5) [`0458277`](https://github.com/maxa-ondrej/sideline/commit/0458277c509fccaa36fefdc7f2d9a8e9833caa83) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add Czech + English i18n support with Paraglide JS, language switcher, persistent user locale, and locale-aware formatting

- Updated dependencies [[`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab), [`0458277`](https://github.com/maxa-ondrej/sideline/commit/0458277c509fccaa36fefdc7f2d9a8e9833caa83), [`6579f9e`](https://github.com/maxa-ondrej/sideline/commit/6579f9e28eaf8f5ea2ef9d388e092a7cf672198b), [`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab), [`2776ed6`](https://github.com/maxa-ondrej/sideline/commit/2776ed65f129a1206637332b94bdf64a9280cfeb), [`a89cf75`](https://github.com/maxa-ondrej/sideline/commit/a89cf758025d95caae8a98c4337e9679c8bf301e)]:
  - @sideline/domain@0.1.0
