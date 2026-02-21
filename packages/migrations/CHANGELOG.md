# @sideline/migrations

## 0.1.2

### Patch Changes

- [`744d79a`](https://github.com/maxa-ondrej/sideline/commit/744d79a7e2f827ccfc136e79c2a8b5f5b0872ced) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Decouple NodeFileSystem from Migrator export, allowing consumers to provide their own filesystem layer

## 0.1.1

### Patch Changes

- [#9](https://github.com/maxa-ondrej/sideline/pull/9) [`851b9b2`](https://github.com/maxa-ondrej/sideline/commit/851b9b247e8b5f39db63a7d5c1748f3febc47f5a) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Decouple NodeFileSystem from Migrator export, allowing consumers to provide their own filesystem layer

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

- [#4](https://github.com/maxa-ondrej/sideline/pull/4) [`e3a3938`](https://github.com/maxa-ondrej/sideline/commit/e3a393841205f203c16c65dfb0f05a8a5b656cab) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add profile completion flow: migration for profile fields, API endpoint, form UI, and tests

- [#3](https://github.com/maxa-ondrej/sideline/pull/3) [`a89cf75`](https://github.com/maxa-ondrej/sideline/commit/a89cf758025d95caae8a98c4337e9679c8bf301e) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add teams, team invites, and profile completion flow

### Patch Changes

- [#5](https://github.com/maxa-ondrej/sideline/pull/5) [`0458277`](https://github.com/maxa-ondrej/sideline/commit/0458277c509fccaa36fefdc7f2d9a8e9833caa83) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add Czech + English i18n support with Paraglide JS, language switcher, persistent user locale, and locale-aware formatting
