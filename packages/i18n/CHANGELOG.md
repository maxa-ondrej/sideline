# @sideline/i18n

## 0.3.12

### Patch Changes

- [#232](https://github.com/maxa-ondrej/sideline/pull/232) [`ee68d21`](https://github.com/maxa-ondrej/sideline/commit/ee68d215ab1a26accc771119c3249b99aa6c9c71) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Improve the reminders feature: configurable reminder time and timezone (per-team), dedicated reminders channel, member-group-aware audience and role mentions, and a new "Starting now" announcement when an event begins.

  Team settings now expose `rsvpReminderDaysBefore`, `rsvpReminderTime` (HH:MM, capped at 23:54 to avoid midnight wrap), `timezone` (any IANA zone, default `Europe/Prague`), and `remindersChannelId`. Reminders fire at the configured time in the team's timezone with a 5-minute tolerance window. The reminder embed and the new "Starting now" post target the reminders channel (falling back to the owner-group channel, then the guild's system channel) and mention the event's member-group role. The reminder's "Going" and "Not yet responded" lists are filtered to the member group when one is set.

- [#227](https://github.com/maxa-ondrej/sideline/pull/227) [`13f887c`](https://github.com/maxa-ondrej/sideline/commit/13f887ced827ab2425a279da00281b183c15a1ea) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add Documentation and Report a bug links to the user menu in the web navigation sidebar. Both open in a new tab: Documentation points to the hosted Starlight docs, Report a bug opens a fresh GitHub issue.

## 0.3.11

### Patch Changes

- [#222](https://github.com/maxa-ondrej/sideline/pull/222) [`f235bf5`](https://github.com/maxa-ondrej/sideline/commit/f235bf5c181ec88cdcd923aca1d71edba46d6a3b) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Show Discord mentions alongside names in RSVP reminder messages and the late-RSVP channel
  - RSVP reminder embeds now render attendees as `**Name** (<@id>)` instead of `**Name**` alone, matching the format used in the attendees list.
  - Late-RSVP notifications (posted to the channel configured via `discord_channel_late_rsvp` after the reminder is sent) also now include the user's name alongside the mention, sourced from the new name fields on `SubmitRsvpResult`.
  - Reminder attendee lists now truncate with a localised "…and N more" suffix when the joined text would exceed Discord's 1024-character embed-field limit, preventing `createMessage` from failing for large teams.
  - Closes a related edge case in the attendees list where a user with only `display_name` (no name/nickname/username) would render as mention-only.

## 0.3.10

### Patch Changes

- [#199](https://github.com/maxa-ondrej/sideline/pull/199) [`b64c794`](https://github.com/maxa-ondrej/sideline/commit/b64c794005a3249889ea374f4ef13e9419fea6a9) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix unreliable Discord mentions on mobile by showing bold names as primary display instead of @mentions in event embeds, attendees lists, and RSVP reminders. Add /event pending subcommand to list events awaiting the user's RSVP.

- [#197](https://github.com/maxa-ondrej/sideline/pull/197) [`19d94f2`](https://github.com/maxa-ondrej/sideline/commit/19d94f2bb999bd6465b2a41955d7cae1a2dc7135) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Remove RSVP confirmation step on web — clicking Yes/No/Maybe now immediately submits the response, matching the Discord bot behavior

- [#203](https://github.com/maxa-ondrej/sideline/pull/203) [`d2d3eb6`](https://github.com/maxa-ondrej/sideline/commit/d2d3eb666c115009d1d24d1d4c80071633ba2e38) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Redesign /event upcoming to show one full event embed per page with per-user RSVP status. Add /event overview command for persistent channel button. Remove /event pending.

- [#195](https://github.com/maxa-ondrej/sideline/pull/195) [`0704c17`](https://github.com/maxa-ondrej/sideline/commit/0704c17897ced04f67ee10a7ed65cd0ec51f74d7) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Reorder attendance channel messages so the nearest upcoming event is the last (most visible) message, and add a divider between past and future events

## 0.3.9

### Patch Changes

- [#186](https://github.com/maxa-ondrej/sideline/pull/186) [`16192c7`](https://github.com/maxa-ondrej/sideline/commit/16192c762bbef950c6eb587a74c5925cec954cf3) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add preferredLanguage strategy to detect browser language for first-time visitors

- [#189](https://github.com/maxa-ondrej/sideline/pull/189) [`bfbc107`](https://github.com/maxa-ondrej/sideline/commit/bfbc107dae79520fc5801792b5aede8f05ed4e83) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Remove RSVP buttons from Discord event messages after an event starts and mark events as started via a new cron job.

- [#188](https://github.com/maxa-ondrej/sideline/pull/188) [`12fb74d`](https://github.com/maxa-ondrej/sideline/commit/12fb74d22d5c0c118dc803bc6cbbdfd3faeb9271) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add searchable select component with search filtering and alphabetical sorting to all dynamic select boxes (channels, groups, members, roles, training types) across the web app.

## 0.3.8

### Patch Changes

- [#182](https://github.com/maxa-ondrej/sideline/pull/182) [`a5c51c1`](https://github.com/maxa-ondrej/sideline/commit/a5c51c1885911f23c41e77e6a3244b950f5380fc) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - RSVP now saves immediately on button click. Ephemeral confirmation shows "Add a message" button (or "Edit message" + "Clear message" if a message already exists). Message is preserved when re-clicking the same RSVP button.

## 0.3.7

### Patch Changes

- [#178](https://github.com/maxa-ondrej/sideline/pull/178) [`24174e9`](https://github.com/maxa-ondrej/sideline/commit/24174e90b31d73c8bf5f5181a087a41c3289ae54) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add late RSVP notifications: when a member responds after the reminder is sent, post a notification to a configurable team channel and show a polite hint in the RSVP confirmation. Also include the list of yes attendees in the reminder embed.

## 0.3.6

### Patch Changes

- [`cc742d8`](https://github.com/maxa-ondrej/sideline/commit/cc742d8f5ae355e7485593255629b5fada51bda0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Show a list of yes attendees on RSVP event embeds

## 0.3.5

### Patch Changes

- [#153](https://github.com/maxa-ondrej/sideline/pull/153) [`690c5c0`](https://github.com/maxa-ondrej/sideline/commit/690c5c0be363ef1461e74a20ad0545ba140282db) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add 3-mode Discord channel cleanup (nothing, delete, archive) with separate settings for groups and rosters

- [#168](https://github.com/maxa-ondrej/sideline/pull/168) [`2284bea`](https://github.com/maxa-ondrej/sideline/commit/2284bea83d34f7f93768457ca401fc45dfe6d4e2) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Display Discord channels as clickable links that open the actual channel in Discord

- [#154](https://github.com/maxa-ondrej/sideline/pull/154) [`883189a`](https://github.com/maxa-ondrej/sideline/commit/883189a4c56c2da0c2dcf92544bb72445bbc343a) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add configurable Discord channel/role name format templates to team settings

- [#169](https://github.com/maxa-ondrej/sideline/pull/169) [`1e8def9`](https://github.com/maxa-ondrej/sideline/commit/1e8def9790e7b31c9eb15faf81c71641d69e9d2d) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add color and emoji support to groups and rosters with Discord role sync

- [#146](https://github.com/maxa-ondrej/sideline/pull/146) [`b871b3c`](https://github.com/maxa-ondrej/sideline/commit/b871b3c3def2b9eb2397a2072e88eb99d9c87170) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add discord channel linking to rosters with auto-creation, role management, and web UI

## 0.3.4

### Patch Changes

- [#140](https://github.com/maxa-ondrej/sideline/pull/140) [`247fa44`](https://github.com/maxa-ondrej/sideline/commit/247fa444ad52fc44796e54ac9231a73221c29ff0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add team setting to control whether Discord channels are auto-created for new groups

- [#141](https://github.com/maxa-ondrej/sideline/pull/141) [`e4f8969`](https://github.com/maxa-ondrej/sideline/commit/e4f8969bcaf1278169e6e5a6aa2b3af49701ec78) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Fix incorrect permissions: add group:manage permission, gate nav items by role, fix avatar rendering and drawer padding

## 0.3.3

### Patch Changes

- [#131](https://github.com/maxa-ondrej/sideline/pull/131) [`0d1567e`](https://github.com/maxa-ondrej/sideline/commit/0d1567eb18fd472e24bc40ac01238c8c6395a983) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Auto-join users to existing teams matching their Discord guilds after profile completion

- [#130](https://github.com/maxa-ondrej/sideline/pull/130) [`d689595`](https://github.com/maxa-ondrej/sideline/commit/d6895955ebb2f1a8de72fdf6d18e9035ee022eee) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add success toast notifications to all user actions and fix runtime to decouple loading/success toasts

- [#128](https://github.com/maxa-ondrej/sideline/pull/128) [`b629285`](https://github.com/maxa-ondrej/sideline/commit/b629285a4bfa1e7ff277f5257045bbaf6196148e) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Improve website design: dark mode toggle, sidebar sections, hero page, RSVP side panel, leaderboard redesign, workout layout, team logo in switcher, and calendar subscription consistency

## 0.3.2

### Patch Changes

- [#125](https://github.com/maxa-ondrej/sideline/pull/125) [`4a471dc`](https://github.com/maxa-ondrej/sideline/commit/4a471dc4bc0000168c25fef000ded1ecfd11fd09) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add responsive design and PWA support for mobile devices. Auto-close sidebar on navigation, sticky header, responsive table-to-card layouts, touch target optimization, PWA manifest with service worker, and install prompt.

- [#123](https://github.com/maxa-ondrej/sideline/pull/123) [`8d97865`](https://github.com/maxa-ondrej/sideline/commit/8d978654612cab81032e51a3e602ddcf07918ac0) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add team profile settings (name, description, sport, logo URL) with new API endpoints, card-based settings page, and Discord channel configuration UI improvements

## 0.3.1

### Patch Changes

- [#121](https://github.com/maxa-ondrej/sideline/pull/121) [`737817d`](https://github.com/maxa-ondrej/sideline/commit/737817d36047e914a30f2d2c54b2220b96de21c5) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add team leaderboard with activity rankings, streaks, web page, and Discord command

- [#122](https://github.com/maxa-ondrej/sideline/pull/122) [`683e8cb`](https://github.com/maxa-ondrej/sideline/commit/683e8cb3e0098fe2802cab6140f5986707d55136) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add personalized dashboard as the team home page with upcoming events, awaiting RSVP, activity summary, and team management widgets

## 0.3.0

### Minor Changes

- [#115](https://github.com/maxa-ondrej/sideline/pull/115) [`174013c`](https://github.com/maxa-ondrej/sideline/commit/174013ca0e42655ee261423a0bddcebb894e83d2) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add player activity streaks and stats — streak calculation, /makanicko stats Discord command, web profile stats card, and HTTP API endpoint

### Patch Changes

- [#114](https://github.com/maxa-ondrej/sideline/pull/114) [`c902f5a`](https://github.com/maxa-ondrej/sideline/commit/c902f5aeb9551c43309f3e70134527dd39c5eb49) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add activity logging via Discord slash command (/makanicko log)

## 0.2.1

### Patch Changes

- [#103](https://github.com/maxa-ondrej/sideline/pull/103) [`79ca632`](https://github.com/maxa-ondrej/sideline/commit/79ca6325566fc6a2c9e37d4551bcea4f6507d03d) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add owner/member group assignment to events, event series, and training types for group-based access control and visibility

- [#104](https://github.com/maxa-ondrej/sideline/pull/104) [`5d2979f`](https://github.com/maxa-ondrej/sideline/commit/5d2979f3ee666d24b461994e2ddb51abd2ce7017) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Enforce group membership checks on RSVP endpoints

## 0.2.0

### Minor Changes

- [#98](https://github.com/maxa-ondrej/sideline/pull/98) [`c12900d`](https://github.com/maxa-ondrej/sideline/commit/c12900da82a09999081325bccbb29a39f93f3215) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add iCal subscription feature allowing players to subscribe to team events via webcal URL in Google Calendar, Apple Calendar, and Outlook

### Patch Changes

- [#88](https://github.com/maxa-ondrej/sideline/pull/88) [`3b20ab1`](https://github.com/maxa-ondrej/sideline/commit/3b20ab1ed4d61dffc0d136d6ee6a055672e65788) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add client-side age validation with localized error message and preselect birth year to 18 years ago in date picker

- [#96](https://github.com/maxa-ondrej/sideline/pull/96) [`b49b814`](https://github.com/maxa-ondrej/sideline/commit/b49b814c7166d2ae2d95b00a95ec87a55cb8e9b6) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add /event-list Discord slash command with paginated upcoming events embed

- [#85](https://github.com/maxa-ondrej/sideline/pull/85) [`3b16731`](https://github.com/maxa-ondrej/sideline/commit/3b1673170ea6bb9b44b298fc3566415f016ea654) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add form validation and field-error i18n messages

- [#97](https://github.com/maxa-ondrej/sideline/pull/97) [`0230c98`](https://github.com/maxa-ondrej/sideline/commit/0230c98db317f20800485a0ad758020236ff2f77) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Remove /ping slash command from Discord bot

- [#87](https://github.com/maxa-ondrej/sideline/pull/87) [`381d85d`](https://github.com/maxa-ondrej/sideline/commit/381d85d6f47deb87f68bcebd5a266e0f29bb71f3) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add i18n keys for sidebar navigation, user menu, team switcher, and breadcrumbs

## 0.1.2

### Patch Changes

- [#75](https://github.com/maxa-ondrej/sideline/pull/75) [`f21c610`](https://github.com/maxa-ondrej/sideline/commit/f21c61061b8b67faa87a2cadfec3f728603cae1f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add events calendar view with month/week modes, training type color coding, and responsive layout

- [#77](https://github.com/maxa-ondrej/sideline/pull/77) [`f71d644`](https://github.com/maxa-ondrej/sideline/commit/f71d644aff2f4d181986b1510467577adb14fadc) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Support multiple days of week for event series (e.g. Mon+Wed+Fri) with toggleable day buttons UI

- [#78](https://github.com/maxa-ondrej/sideline/pull/78) [`5d55e46`](https://github.com/maxa-ondrej/sideline/commit/5d55e463e6be04b01ac87377825a2372caa2713f) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Send RSVP reminder DMs to non-responders who have a Discord account

## 0.1.1

### Patch Changes

- [#71](https://github.com/maxa-ondrej/sideline/pull/71) [`7af4d2d`](https://github.com/maxa-ondrej/sideline/commit/7af4d2d74a4280a53f2aa07f9919451a918a9d07) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Add publishConfig and dist/package.json generation to follow domain package structure for public publishing

## 0.1.0

### Minor Changes

- [#67](https://github.com/maxa-ondrej/sideline/pull/67) [`ca6db57`](https://github.com/maxa-ondrej/sideline/commit/ca6db57efc94442f6a690322ea1ae52355e1d903) Thanks [@maxa-ondrej](https://github.com/maxa-ondrej)! - Make i18n package public for publishing
