# @sideline/server

## 0.12.0

### Minor Changes

- [#117](https://github.com/maxa-ondrej/sideline/pull/117) [`1d39492`](https://github.com/maxa-ondrej/sideline/commit/1d394922570fb268808b92b0ceacd555048cc35a) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Replace hardcoded activity types with a global activity_types table, auto-track training attendance via cron after events end, and switch stats to dynamic counts

- [#116](https://github.com/maxa-ondrej/sideline/pull/116) [`0fb3acd`](https://github.com/maxa-ondrej/sideline/commit/0fb3acd1ebf9afa6fc7b4fc6d9e14d5b786df4f1) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add activity logging via web app with quick-log widget, history page, and edit/delete support

- [#115](https://github.com/maxa-ondrej/sideline/pull/115) [`174013c`](https://github.com/maxa-ondrej/sideline/commit/174013ca0e42655ee261423a0bddcebb894e83d2) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add player activity streaks and stats — streak calculation, /makanicko stats Discord command, web profile stats card, and HTTP API endpoint

### Patch Changes

- [#114](https://github.com/maxa-ondrej/sideline/pull/114) [`c902f5a`](https://github.com/maxa-ondrej/sideline/commit/c902f5aeb9551c43309f3e70134527dd39c5eb49) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add activity logging via Discord slash command (/makanicko log)

- [#111](https://github.com/maxa-ondrej/sideline/pull/111) [`66a30b3`](https://github.com/maxa-ondrej/sideline/commit/66a30b3b88b907f16dd84bf6304ab82e1204622c) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Refactor block-body arrow functions to expression-body arrows and replace nested calls with pipe chains

- [#108](https://github.com/maxa-ondrej/sideline/pull/108) [`0fc40b6`](https://github.com/maxa-ondrej/sideline/commit/0fc40b6cb2f3f765e2b65cf2343de39efb53e652) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add training type selection to Discord event creation flow

- Updated dependencies [[`1d39492`](https://github.com/maxa-ondrej/sideline/commit/1d394922570fb268808b92b0ceacd555048cc35a), [`c902f5a`](https://github.com/maxa-ondrej/sideline/commit/c902f5aeb9551c43309f3e70134527dd39c5eb49), [`0fb3acd`](https://github.com/maxa-ondrej/sideline/commit/0fb3acd1ebf9afa6fc7b4fc6d9e14d5b786df4f1), [`174013c`](https://github.com/maxa-ondrej/sideline/commit/174013ca0e42655ee261423a0bddcebb894e83d2), [`0fc40b6`](https://github.com/maxa-ondrej/sideline/commit/0fc40b6cb2f3f765e2b65cf2343de39efb53e652)]:
  - @sideline/domain@0.12.0
  - @sideline/migrations@0.12.0

## 0.11.1

### Patch Changes

- [#106](https://github.com/maxa-ondrej/sideline/pull/106) [`48918cf`](https://github.com/maxa-ondrej/sideline/commit/48918cf45c8655e4fda20a1f83d01b309c316477) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix coach scoping query to include group-inherited roles when resolving scoped training type IDs

## 0.11.0

### Minor Changes

- [#103](https://github.com/maxa-ondrej/sideline/pull/103) [`79ca632`](https://github.com/maxa-ondrej/sideline/commit/79ca6325566fc6a2c9e37d4551bcea4f6507d03d) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add owner/member group assignment to events, event series, and training types for group-based access control and visibility

### Patch Changes

- [#104](https://github.com/maxa-ondrej/sideline/pull/104) [`5d2979f`](https://github.com/maxa-ondrej/sideline/commit/5d2979f3ee666d24b461994e2ddb51abd2ce7017) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Enforce group membership checks on RSVP endpoints

- [#101](https://github.com/maxa-ondrej/sideline/pull/101) [`9584a67`](https://github.com/maxa-ondrej/sideline/commit/9584a6700fa5dcc86d1ccfed5ed44c07db9f3570) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Hide UI elements from users without required permissions (role and roster management buttons, admin sidebar links, events page for non-admins)

- Updated dependencies [[`79ca632`](https://github.com/maxa-ondrej/sideline/commit/79ca6325566fc6a2c9e37d4551bcea4f6507d03d), [`5d2979f`](https://github.com/maxa-ondrej/sideline/commit/5d2979f3ee666d24b461994e2ddb51abd2ce7017), [`9584a67`](https://github.com/maxa-ondrej/sideline/commit/9584a6700fa5dcc86d1ccfed5ed44c07db9f3570), [`79ca632`](https://github.com/maxa-ondrej/sideline/commit/79ca6325566fc6a2c9e37d4551bcea4f6507d03d)]:
  - @sideline/migrations@0.11.0
  - @sideline/domain@0.11.0
  - @sideline/effect-lib@0.0.5

## 0.10.0

### Minor Changes

- [#98](https://github.com/maxa-ondrej/sideline/pull/98) [`c12900d`](https://github.com/maxa-ondrej/sideline/commit/c12900da82a09999081325bccbb29a39f93f3215) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add iCal subscription feature allowing players to subscribe to team events via webcal URL in Google Calendar, Apple Calendar, and Outlook

### Patch Changes

- [#91](https://github.com/maxa-ondrej/sideline/pull/91) [`dbe2a0b`](https://github.com/maxa-ondrej/sideline/commit/dbe2a0b480314845e45bcae95ea100ce0d06cf25) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Replace plain string dates with proper DateTime.Utc types throughout the stack

- [#90](https://github.com/maxa-ondrej/sideline/pull/90) [`c885234`](https://github.com/maxa-ondrej/sideline/commit/c885234c8f89088b1cc49a4619b69a617a8e9976) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Replace native JS array methods with Effect Array module in server and bot

- [#96](https://github.com/maxa-ondrej/sideline/pull/96) [`b49b814`](https://github.com/maxa-ondrej/sideline/commit/b49b814c7166d2ae2d95b00a95ec87a55cb8e9b6) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add /event-list Discord slash command with paginated upcoming events embed

- [#89](https://github.com/maxa-ondrej/sideline/pull/89) [`4d2ce92`](https://github.com/maxa-ondrej/sideline/commit/4d2ce92b94498e0683756fb4e1439cda51001abc) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Use Discord.Snowflake branded type across the entire stack, remove catchAll on unfailable effects, and refactor repository methods to use destructuring with default values

- [#83](https://github.com/maxa-ondrej/sideline/pull/83) [`38381e3`](https://github.com/maxa-ondrej/sideline/commit/38381e3695b8d2d5fc6704df9dfa8d29e55e2e0a) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Improve server error handling: restructure repositories to use private class fields, replace Effect.orDie with targeted Effect.catchTag('SqlError', 'ParseError', Effect.die) so only infrastructure errors become defects while NoSuchElementException remains typed

- [#81](https://github.com/maxa-ondrej/sideline/pull/81) [`e9809ab`](https://github.com/maxa-ondrej/sideline/commit/e9809ab5ee687de7db088da83a06dce0790adec2) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add LOG_LEVEL environment variable to override default log levels

- [#83](https://github.com/maxa-ondrej/sideline/pull/83) [`38381e3`](https://github.com/maxa-ondrej/sideline/commit/38381e3695b8d2d5fc6704df9dfa8d29e55e2e0a) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Replace NoSuchElementException with Option.match, add per-type emit methods to sync repos, and type User.discord_id as Snowflake

- [#83](https://github.com/maxa-ondrej/sideline/pull/83) [`38381e3`](https://github.com/maxa-ondrej/sideline/commit/38381e3695b8d2d5fc6704df9dfa8d29e55e2e0a) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add typed business errors for unique constraint violations in repositories

- [#95](https://github.com/maxa-ondrej/sideline/pull/95) [`3d3b6e4`](https://github.com/maxa-ondrej/sideline/commit/3d3b6e400d45be9b2020fa7d43bb2e829e5a382e) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Sync web RSVP responses to Discord by emitting event_updated sync event after upsertRsvp

- Updated dependencies [[`3b20ab1`](https://github.com/maxa-ondrej/sideline/commit/3b20ab1ed4d61dffc0d136d6ee6a055672e65788), [`dbe2a0b`](https://github.com/maxa-ondrej/sideline/commit/dbe2a0b480314845e45bcae95ea100ce0d06cf25), [`b49b814`](https://github.com/maxa-ondrej/sideline/commit/b49b814c7166d2ae2d95b00a95ec87a55cb8e9b6), [`c12900d`](https://github.com/maxa-ondrej/sideline/commit/c12900da82a09999081325bccbb29a39f93f3215), [`4d2ce92`](https://github.com/maxa-ondrej/sideline/commit/4d2ce92b94498e0683756fb4e1439cda51001abc), [`e9809ab`](https://github.com/maxa-ondrej/sideline/commit/e9809ab5ee687de7db088da83a06dce0790adec2), [`38381e3`](https://github.com/maxa-ondrej/sideline/commit/38381e3695b8d2d5fc6704df9dfa8d29e55e2e0a), [`38381e3`](https://github.com/maxa-ondrej/sideline/commit/38381e3695b8d2d5fc6704df9dfa8d29e55e2e0a)]:
  - @sideline/domain@0.10.0
  - @sideline/effect-lib@0.0.4
  - @sideline/migrations@0.10.0

## 0.9.0

### Minor Changes

- [#77](https://github.com/maxa-ondrej/sideline/pull/77) [`f71d644`](https://github.com/maxa-ondrej/sideline/commit/f71d644aff2f4d181986b1510467577adb14fadc) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Support multiple days of week for event series (e.g. Mon+Wed+Fri) with toggleable day buttons UI

- [#78](https://github.com/maxa-ondrej/sideline/pull/78) [`5d55e46`](https://github.com/maxa-ondrej/sideline/commit/5d55e463e6be04b01ac87377825a2372caa2713f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add RSVP reminders and threshold warnings with non-responder visibility

### Patch Changes

- [#79](https://github.com/maxa-ondrej/sideline/pull/79) [`7dccd31`](https://github.com/maxa-ondrej/sideline/commit/7dccd31fe72f0063e7092cc4e762698b32a83e34) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add /event-create Discord slash command for creating events via bot modal

- [#78](https://github.com/maxa-ondrej/sideline/pull/78) [`5d55e46`](https://github.com/maxa-ondrej/sideline/commit/5d55e463e6be04b01ac87377825a2372caa2713f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Run RSVP reminder cron every minute instead of every hour

- Updated dependencies [[`7dccd31`](https://github.com/maxa-ondrej/sideline/commit/7dccd31fe72f0063e7092cc4e762698b32a83e34), [`f71d644`](https://github.com/maxa-ondrej/sideline/commit/f71d644aff2f4d181986b1510467577adb14fadc), [`5d55e46`](https://github.com/maxa-ondrej/sideline/commit/5d55e463e6be04b01ac87377825a2372caa2713f)]:
  - @sideline/domain@0.9.0
  - @sideline/migrations@0.9.0

## 0.8.0

### Minor Changes

- [#73](https://github.com/maxa-ondrej/sideline/pull/73) [`bbaec4d`](https://github.com/maxa-ondrej/sideline/commit/bbaec4d84940ca8aad14ac650ea6214b3e6ee645) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Rename discord_username/discord_avatar to username/avatar across the codebase and fix RSVP member name display to fall back to username

### Patch Changes

- Updated dependencies [[`bbaec4d`](https://github.com/maxa-ondrej/sideline/commit/bbaec4d84940ca8aad14ac650ea6214b3e6ee645)]:
  - @sideline/domain@0.8.0
  - @sideline/migrations@0.8.0

## 0.7.1

### Patch Changes

- [#69](https://github.com/maxa-ondrej/sideline/pull/69) [`5455854`](https://github.com/maxa-ondrej/sideline/commit/5455854590e40219532403d35dc2e068fd5b62d3) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Reorder Discord event messages by start date after creating or updating events

- Updated dependencies [[`5455854`](https://github.com/maxa-ondrej/sideline/commit/5455854590e40219532403d35dc2e068fd5b62d3)]:
  - @sideline/domain@0.7.1

## 0.7.0

### Minor Changes

- [#66](https://github.com/maxa-ondrej/sideline/pull/66) [`7c483c5`](https://github.com/maxa-ondrej/sideline/commit/7c483c5a68b9ebf115ccd141d487e334fdee4c2e) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Extract OAuth into oauth_connections table and auto-register Discord guild members as team members

### Patch Changes

- Updated dependencies [[`7c483c5`](https://github.com/maxa-ondrej/sideline/commit/7c483c5a68b9ebf115ccd141d487e334fdee4c2e)]:
  - @sideline/domain@0.7.0
  - @sideline/migrations@0.7.0

## 0.6.2

### Patch Changes

- [#58](https://github.com/maxa-ondrej/sideline/pull/58) [`fc4a030`](https://github.com/maxa-ondrej/sideline/commit/fc4a030319bbe581bf1b82b289711ecdb0731dac) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Migrate EventsRepository schemas from NullOr to OptionFromNullOr for consistent Option types across the repository layer

- Updated dependencies [[`fc4a030`](https://github.com/maxa-ondrej/sideline/commit/fc4a030319bbe581bf1b82b289711ecdb0731dac)]:
  - @sideline/domain@0.6.1

## 0.6.1

### Patch Changes

- [#56](https://github.com/maxa-ondrej/sideline/pull/56) [`0862067`](https://github.com/maxa-ondrej/sideline/commit/08620678ecfec4626c8d6d48f68b3a4af3852c15) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Move Discord OAuth preview redirect logic from server to nginx proxy via njs module

## 0.6.0

### Minor Changes

- [#53](https://github.com/maxa-ondrej/sideline/pull/53) [`41d6d6a`](https://github.com/maxa-ondrej/sideline/commit/41d6d6aa26130a3f4e09386b607a18ed7063cdf0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add recurring training events (weekly/biweekly series with materialized instances)

- [#51](https://github.com/maxa-ondrej/sideline/pull/51) [`a2b503c`](https://github.com/maxa-ondrej/sideline/commit/a2b503ce5e7dce8835af0182fa3c8e7242c98355) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add events feature: captains and coaches can create, view, edit, and cancel team events (training, match, tournament, meeting, social, other) with coach scoping via role_training_types

- [#55](https://github.com/maxa-ondrej/sideline/pull/55) [`001061a`](https://github.com/maxa-ondrej/sideline/commit/001061aeb91bcf2bae85e778c89c91226bbbdb6f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add configurable Discord channel targeting for events at three levels: per-event/series, per-training-type default, and per-event-type in team settings

### Patch Changes

- [#54](https://github.com/maxa-ondrej/sideline/pull/54) [`2badaeb`](https://github.com/maxa-ondrej/sideline/commit/2badaebfb5fd221dd84209a2925e5f3c4ead6c75) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Migrate birth_year to birth_date: store full date instead of year, add DatePicker UI

- [#53](https://github.com/maxa-ondrej/sideline/pull/53) [`41d6d6a`](https://github.com/maxa-ondrej/sideline/commit/41d6d6aa26130a3f4e09386b607a18ed7063cdf0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add edit UI for recurring schedules and change event ordering to ascending

- [#54](https://github.com/maxa-ondrej/sideline/pull/54) [`2badaeb`](https://github.com/maxa-ondrej/sideline/commit/2badaebfb5fd221dd84209a2925e5f3c4ead6c75) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Refactor event date/time from separate columns to TIMESTAMPTZ and extract DateTimeFromDate schema to effect-lib

- [#54](https://github.com/maxa-ondrej/sideline/pull/54) [`2badaeb`](https://github.com/maxa-ondrej/sideline/commit/2badaebfb5fd221dd84209a2925e5f3c4ead6c75) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add RSVP feature for team events — players can respond Yes/No/Maybe with optional message via web app

- [#51](https://github.com/maxa-ondrej/sideline/pull/51) [`a2b503c`](https://github.com/maxa-ondrej/sideline/commit/a2b503ce5e7dce8835af0182fa3c8e7242c98355) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix coach scoping to check requesting user instead of event creator, use Option-based UpdateEventRequest schema, and fix Event model updated_at field type

- [#53](https://github.com/maxa-ondrej/sideline/pull/53) [`41d6d6a`](https://github.com/maxa-ondrej/sideline/commit/41d6d6aa26130a3f4e09386b607a18ed7063cdf0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix recurring events form interactivity and add recurring schedule management to training type detail page

- [#54](https://github.com/maxa-ondrej/sideline/pull/54) [`2badaeb`](https://github.com/maxa-ondrej/sideline/commit/2badaebfb5fd221dd84209a2925e5f3c4ead6c75) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix timezone handling: append Z suffix to datetime strings and use AT TIME ZONE 'UTC' for date extraction in SQL

- [#53](https://github.com/maxa-ondrej/sideline/pull/53) [`41d6d6a`](https://github.com/maxa-ondrej/sideline/commit/41d6d6aa26130a3f4e09386b607a18ed7063cdf0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add rolling horizon event generation with configurable per-team horizon days

- [#55](https://github.com/maxa-ondrej/sideline/pull/55) [`001061a`](https://github.com/maxa-ondrej/sideline/commit/001061aeb91bcf2bae85e778c89c91226bbbdb6f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add view attendees feature with ephemeral embed and pagination on event RSVP

- Updated dependencies [[`41d6d6a`](https://github.com/maxa-ondrej/sideline/commit/41d6d6aa26130a3f4e09386b607a18ed7063cdf0), [`2badaeb`](https://github.com/maxa-ondrej/sideline/commit/2badaebfb5fd221dd84209a2925e5f3c4ead6c75), [`a2b503c`](https://github.com/maxa-ondrej/sideline/commit/a2b503ce5e7dce8835af0182fa3c8e7242c98355), [`001061a`](https://github.com/maxa-ondrej/sideline/commit/001061aeb91bcf2bae85e778c89c91226bbbdb6f), [`2badaeb`](https://github.com/maxa-ondrej/sideline/commit/2badaebfb5fd221dd84209a2925e5f3c4ead6c75), [`2badaeb`](https://github.com/maxa-ondrej/sideline/commit/2badaebfb5fd221dd84209a2925e5f3c4ead6c75), [`a2b503c`](https://github.com/maxa-ondrej/sideline/commit/a2b503ce5e7dce8835af0182fa3c8e7242c98355), [`41d6d6a`](https://github.com/maxa-ondrej/sideline/commit/41d6d6aa26130a3f4e09386b607a18ed7063cdf0), [`41d6d6a`](https://github.com/maxa-ondrej/sideline/commit/41d6d6aa26130a3f4e09386b607a18ed7063cdf0), [`001061a`](https://github.com/maxa-ondrej/sideline/commit/001061aeb91bcf2bae85e778c89c91226bbbdb6f)]:
  - @sideline/domain@0.6.0
  - @sideline/migrations@0.6.0
  - @sideline/effect-lib@0.0.3

## 0.5.1

### Patch Changes

- [`90b50bb`](https://github.com/maxa-ondrej/sideline/commit/90b50bbf8317901cedaa7cda8216ecef12be9acc) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Patch bump all applications

## 0.5.0

### Minor Changes

- [#47](https://github.com/maxa-ondrej/sideline/pull/47) [`85d3108`](https://github.com/maxa-ondrej/sideline/commit/85d3108070f0868622a56d75a3cdd813b57e03bd) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Rework groups and roles: rename subgroups to groups with hierarchical support, assign roles to groups with recursive permission inheritance, scope training types to groups instead of coaches, and update age thresholds to operate on groups

### Patch Changes

- [#48](https://github.com/maxa-ondrej/sideline/pull/48) [`bdacd74`](https://github.com/maxa-ondrej/sideline/commit/bdacd74ce3ef5900ba18b266ef4836b284059428) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Emit channel_created event when linking an existing channel so the bot creates a role, and show channel names instead of raw snowflake IDs

- [#48](https://github.com/maxa-ondrej/sideline/pull/48) [`bdacd74`](https://github.com/maxa-ondrej/sideline/commit/bdacd74ce3ef5900ba18b266ef4836b284059428) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Replace Discord channel ID input with a select dropdown that fetches guild text channels via the user's OAuth token

- [#47](https://github.com/maxa-ondrej/sideline/pull/47) [`85d3108`](https://github.com/maxa-ondrej/sideline/commit/85d3108070f0868622a56d75a3cdd813b57e03bd) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add group hierarchy tree UI with expand/collapse and parent selector, Discord channel mapping HTTP API and group detail section

- [#47](https://github.com/maxa-ondrej/sideline/pull/47) [`85d3108`](https://github.com/maxa-ondrej/sideline/commit/85d3108070f0868622a56d75a3cdd813b57e03bd) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add move-group UI and create-channel endpoint for existing groups

- [#45](https://github.com/maxa-ondrej/sideline/pull/45) [`74544b4`](https://github.com/maxa-ondrej/sideline/commit/74544b4ede8dde9539bcb5c76c25afda279d883b) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add team-scoped authenticated routes and notification filtering

- Updated dependencies [[`bdacd74`](https://github.com/maxa-ondrej/sideline/commit/bdacd74ce3ef5900ba18b266ef4836b284059428), [`bdacd74`](https://github.com/maxa-ondrej/sideline/commit/bdacd74ce3ef5900ba18b266ef4836b284059428), [`85d3108`](https://github.com/maxa-ondrej/sideline/commit/85d3108070f0868622a56d75a3cdd813b57e03bd), [`85d3108`](https://github.com/maxa-ondrej/sideline/commit/85d3108070f0868622a56d75a3cdd813b57e03bd), [`85d3108`](https://github.com/maxa-ondrej/sideline/commit/85d3108070f0868622a56d75a3cdd813b57e03bd), [`74544b4`](https://github.com/maxa-ondrej/sideline/commit/74544b4ede8dde9539bcb5c76c25afda279d883b)]:
  - @sideline/domain@0.5.0
  - @sideline/migrations@0.5.0

## 0.4.0

### Minor Changes

- [#39](https://github.com/maxa-ondrej/sideline/pull/39) [`eb7fdf3`](https://github.com/maxa-ondrej/sideline/commit/eb7fdf3c4607770baf78df856f450f5f303fdc9f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Remove position and proficiency from player data, move jersey number to team members

- [#37](https://github.com/maxa-ondrej/sideline/pull/37) [`0c98f29`](https://github.com/maxa-ondrej/sideline/commit/0c98f291ee6168e73077feec4cdbc89f0ccdfd3f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add training types CRUD with coach assignment

### Patch Changes

- [#44](https://github.com/maxa-ondrej/sideline/pull/44) [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Use explicit is_admin column from DB query instead of inferring admin status from non-empty role IDs

- [#41](https://github.com/maxa-ondrej/sideline/pull/41) [`3a2daa7`](https://github.com/maxa-ondrej/sideline/commit/3a2daa77509b9a1066c48b78e94697db7609e3d6) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add coach-scoped permission checks for training type list, get, and update endpoints

- [#44](https://github.com/maxa-ondrej/sideline/pull/44) [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix double commitChanges in age check, pass subgroup name in member sync events, remove spurious subgroup_name check on member_removed, fix copy-paste log messages in role sync, and prevent duplicate channel creation when mapping lacks role_id

- [#44](https://github.com/maxa-ondrej/sideline/pull/44) [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Use Discord roles for channel permissions instead of per-user permission overwrites

- [#44](https://github.com/maxa-ondrej/sideline/pull/44) [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Refactor RPC layer to use RpcGroup with prefix and configurable RPC_PREFIX env var

- [#44](https://github.com/maxa-ondrej/sideline/pull/44) [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Log RPC polling requests at DEBUG level to reduce log noise

- [#44](https://github.com/maxa-ondrej/sideline/pull/44) [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Soft-delete subgroups and roles via is_archived flag instead of hard deleting rows

- Updated dependencies [[`3a2daa7`](https://github.com/maxa-ondrej/sideline/commit/3a2daa77509b9a1066c48b78e94697db7609e3d6), [`eb7fdf3`](https://github.com/maxa-ondrej/sideline/commit/eb7fdf3c4607770baf78df856f450f5f303fdc9f), [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb), [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb), [`3700082`](https://github.com/maxa-ondrej/sideline/commit/3700082b552e0e87a80bc6fec466d6a54a6317cb), [`0c98f29`](https://github.com/maxa-ondrej/sideline/commit/0c98f291ee6168e73077feec4cdbc89f0ccdfd3f)]:
  - @sideline/domain@0.4.0
  - @sideline/migrations@0.4.0

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
