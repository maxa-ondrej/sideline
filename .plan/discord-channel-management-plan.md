# Plan: Manage Discord Channels from Sideline (Epic 8.1)

**Story:** As an admin, I can manage Discord channels from Sideline
**Branch:** `feat/discord-channel-management`

## Goal
Let admins (anyone with `group:manage`) create, rename, archive, organize, and
manage membership of Discord channels directly from the Sideline web app.

## v1 Scope Cuts (deliberate, to fit ~25h)
- **Text channels only** — no voice (existing helpers hardcode `GUILD_TEXT`).
- **No Discord-side reordering** — `position`/`category` are Sideline-side
  ordering/grouping metadata only. Categories are cosmetic free-text labels used
  to group rows in the web UI; they are NOT created as Discord category objects,
  and channel order in Discord is not changed.
- **Access = group-role grants with access levels** — group/roster channels keep
  their existing single-dedicated-role behavior (untouched). NEW admin-managed
  channels are private (hidden from `@everyone`) and grant access to **existing
  Sideline groups** (each maps to a Discord role) at one of three levels:
  **VIEW / EDIT / ADMIN**, applied as Discord permission overwrites on the group's
  role. ADMIN is bounded — it grants message/thread moderation but NEVER
  `ManageChannels` (no rename/delete). No per-channel dedicated role for managed
  channels.

## Permission model
Reuse the existing **`group:manage`** permission (held by Admin + Captain) for all
channel endpoints, the web nav gate, and the route `beforeLoad` guard. No new
permission, no permission migration.

## Architecture / Data flow
Web (TanStack loader/action) → `ApiClient` → server HTTP handler (gated by
`group:manage`) → writes read-model table(s) AND enqueues a `channel_sync_events`
row via `ChannelSyncEventsRepository` (only if guild linked) → bot poller
`ChannelSyncService` matches the tagged event → calls a Discord REST helper →
marks event processed + reconciles mapping back to the server.

New `'managed'` entity dimension added to the existing channel-sync pipeline,
reusing existing `event_type` literals (`channel_created/updated/deleted/archived`,
`member_added/removed`).

### Authority boundary
- New `team_channels` table is authoritative for **name, category, position,
  archived** (Sideline intent).
- `discord_channels` remains the raw Discord mirror (bot back-sync writes only it).
- `team_channels.discord_channel_id` / `discord_role_id` are the bot-reconciled link.

## Domain (`packages/domain/`) — build first with `pnpm build`
- **D1** `models/ChannelSyncEvent.ts`: `ChannelSyncEntityType` →
  `Schema.Literals(['group','roster','managed'])`; add `managed_channel_id`
  (`OptionFromNullOr(TeamChannelId)`) to the model. No new event_type literals.
- **D2** new `models/TeamChannel.ts`: `TeamChannelId` brand + `TeamChannel`
  Model.Class (id, team_id, name, category, position, archived,
  discord_channel_id, discord_role_id, created_at). Export from `index.ts`.
- **D3** `rpc/channel/ChannelRpcEvents.ts`: add tagged classes
  `ManagedChannelCreated/Updated/Deleted/Archived/MemberAdded/MemberRemoved`,
  add each to its per-type union AND to `UnprocessedChannelEvent`.
- **D4** `rpc/channel/ChannelRpcGroup.ts` + `ChannelRpcModels.ts`: add
  `GetManagedChannel`, `UpsertManagedChannel`, `ClearManagedChannel`,
  `DeleteManagedChannel`.

## Migrations (`packages/migrations/src/before/`, ts ~`1789000000`)
- Create `team_channels` + `team_channel_members` join table.
- `ALTER TABLE channel_sync_events ADD COLUMN managed_channel_id UUID`.
- Verify + relax any `entity_type` CHECK constraint to allow `'managed'`.
- Update `docs/database.md`, `docs/thesis/er-diagram.md`.

## Server (`applications/server/`)
- **S1** new `repositories/TeamChannelsRepository.ts`: findById, findAllByTeam
  (ordered category, position), insert, updateMeta, setArchived, delete,
  findMemberIds, addMembers, removeMembers, upsertDiscordIds, clearDiscordChannel.
- **S2** new `api/team-channel.ts` (pattern: `api/group.ts`): listChannels,
  createChannel, updateChannel, archiveChannel, deleteChannel, getChannelMembers,
  setChannelMembers — every endpoint gated by
  `requirePermission(membership, 'group:manage', forbidden)`. Register in
  `api/index.ts`.
- **S3** `setChannelMembers` in one `sql.withTransaction`: read current members,
  diff vs requested → toAdd/toRemove, optimistically write join table, then emit
  managed member batch events. Last-writer-wins on row locks.
- **S4** extend `repositories/ChannelSyncEventsRepository.ts`: new managed-shaped
  batch emitters (`entity_type='managed'`, with `managed_channel_id`), single
  emitters (created/updated/deleted/archived). Thread `managed_channel_id`
  through `InsertInput`, `EventRow` (as `OptionFromNullOr`), both INSERT column
  lists, and the `findUnprocessedEvents` SELECT.
- **S5** `rpc/channel/events.ts`: add a `Match.when('managed', ...)` branch to
  each of the **7** exhaustive `*FromSql` matchers (created, updated, deleted,
  archived, memberAdded, memberRemoved) — `channelDetached` gets a managed
  branch that fails as impossible-state (managed channels never detach).
- **S6** `rpc/channel/index.ts`: wire managed RPC handlers + `toManagedChannel`.
- Update `docs/api.md`.

## Bot (`applications/bot/`)
- **B1** new handlers `handleManagedCreated/Updated/Deleted/Archived` +
  `handleManagedMemberAdded/Removed`:
  - created: reuse `createDiscordChannelAndRole` → `UpsertManagedChannel`.
  - member add/remove: `addGuildMemberRole`/`removeGuildMemberRole`.
  - archived: move to archive category + delete overwrite, KEEP role →
    `ClearManagedChannel`.
  - deleted: delete channel + role.
- **B2** `rcp/channel/ProcessorService.ts`: add `Match.tag` branches for the 6
  new event tags before `Match.exhaustive`.
- Update `docs/discord-bot.md`.

## Web (`applications/web/`)
- New route `routes/(authenticated)/teams/$teamId/channels.tsx` (`ssr: false`,
  `beforeLoad` re-checks `group:manage`).
- New `ChannelsPage` + organisms: `ChannelManager` (state + polling),
  `CreateChannelDialog` (name + category + private switch, text-only),
  `RenameChannelDialog` (normalization preview), `ChannelAccessSheet`
  (member-only add/remove), `ArchiveChannelDialog` (AlertDialog confirm).
- Molecules `ChannelRow`, `ChannelCategoryGroup`; atom `ChannelStatusBadge`.
- Nav: add **Channels** item (Hash icon) to Coach group in `AppSidebar.tsx`
  gated on `group:manage`. Breadcrumb branch.
- Category-grouped tree (pattern: `GroupsListPage`); drag-reorder + keyboard
  Move up/down/Move-to-category (Sideline-side only); syncing+poll async pattern;
  loading/empty/not-connected/error states; Discord error decoding.
- i18n: add `channels_*` keys to `packages/i18n/messages/{en,cs}.json`.

## Tests (Task 7)
- **events.test.ts**: each `*FromSql` matcher builds the right managed event;
  `channel_detached` + managed fails; group/roster regression intact.
- **ManagedChannelMembers.test.ts**: setMembers diff (add/remove/idempotent),
  concurrency (two concurrent setMembers, final state = one requested set, PK
  prevents dupes), guild-not-linked → no events.
- **TeamChannelApi.test.ts**: permission gating (403 without `group:manage`),
  create/archive/delete/update lifecycle + emitted events; position/category
  change alone emits no Discord event (v1 scope).
- **handleManaged*.test.ts** (bot): created/member-add/member-remove/archived/
  deleted call the right Discord REST ops.
- Integration repo test for `TeamChannelsRepository` (insert/find/rename/archive/
  setMembers transaction/unique-name).

## Docs to update in PR
`docs/database.md`, `docs/api.md`, `docs/discord-bot.md`,
`docs/thesis/{er-diagram,use-cases,sequence-diagrams}.md`,
`applications/docs/.../admin.mdx` + changelog, relevant `AGENTS.md` sections.
