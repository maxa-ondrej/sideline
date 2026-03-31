# Discord Bot (`@sideline/bot`)

Discord bot built with dfx (Discord effect library) and Effect-TS.

## Architecture

```
src/
├── Bot.ts           — Composes commands + interactions + events into program
├── AppLive.ts       — Composable app layer (DiscordIx → HealthServer)
├── HealthServerLive.ts — Health check HTTP endpoint with gateway shard status
├── env.ts           — Environment config (token, intents, health port)
├── run.ts           — Runtime entrypoint (config, logging, NodeRuntime)
├── schemas.ts       — Dfx decode schemas (DfxTextChannel, DfxSyncableChannel, DfxGuildMember, DfxUser)
├── commands/        — Slash command registry (ping.ts, index.ts)
├── interactions/    — Component interaction registry (buttons/selects/modals)
├── events/          — Gateway event handler registry (guild, member lifecycle)
├── services/        — Sync services (RoleSyncService, ChannelSyncService)
└── rcp/channel/     — Channel sync event handlers
    ├── ProcessorService.ts    — Match.tag dispatcher for channel events
    ├── channelUtils.ts        — Shared Discord helpers (deleteRole, deleteChannelAndRole)
    ├── handleCreated.ts       — channel_created handler
    ├── handleDeleted.ts       — channel_deleted handler
    ├── handleArchived.ts      — channel_archived handler (archive or fallback to delete)
    ├── handleMemberAdded.ts   — member_added handler
    ├── handleMemberRemoved.ts — member_removed handler
    └── handleRosterChannelCreated.ts — roster channel_created handler
```

Follows the **AppLive + run.ts** pattern.

## Discord Sync Architecture

The bot and server communicate via an **event-driven polling pattern** for syncing Discord resources.

### Role Sync (roles ↔ Discord roles)

Syncs team roles to Discord guild roles. When roles are created/deleted/assigned/unassigned, the server emits events to `role_sync_events`.

| Component | File |
|-----------|------|
| Domain model | `packages/domain/src/models/RoleSyncEvent.ts` |
| Bot service | `src/services/RoleSyncService.ts` |
| Mapping table | `discord_role_mappings` (team_id + role_id → discord_role_id) |

Event types: `role_created`, `role_deleted`, `role_assigned`, `role_unassigned`

### Channel Sync (groups ↔ Discord channels)

Syncs groups to private Discord text channels with per-user permission overwrites. The guild sync uses `DfxSyncableChannel` (type 0 = text, type 4 = category) to sync both text and category channels from Discord to the database.

| Component | File |
|-----------|------|
| Domain model | `packages/domain/src/models/ChannelSyncEvent.ts` |
| Bot service | `src/services/ChannelSyncService.ts` |
| Mapping table | `discord_channel_mappings` (team_id + group_id → discord_channel_id) |

Event types: `channel_created`, `channel_deleted`, `channel_archived`, `channel_detached`, `member_added`, `member_removed`

**Name fields on `channel_created` events**: The server pre-formats Discord names using team settings. Events carry separate `discord_channel_name` (for the Discord channel) and `discord_role_name` (for the Discord role). Bot handlers should use these fields instead of deriving names from `group_name` or `roster_name`. Exception: `member_added` handlers may fall back to `group_name` since the channel is normally already created by the `channel_created` event with the correct format. The `ensureMapping` and `createDiscordChannelAndRole` functions accept separate `channelName` and `roleName` parameters.

#### Channel Archival

When a team has `discord_archive_category_id` set, deleting a group or deactivating a roster emits `channel_archived` instead of `channel_deleted`. The bot handler in `src/rcp/channel/handleArchived.ts`:

1. Moves the Discord channel to the archive category via `updateChannel({ parent_id })`
2. Deletes the permission overwrite for the channel role
3. Deletes the Discord role
4. On any failure, falls back to full channel+role deletion (same as `channel_deleted`)

Each handler (`handleGroupArchived`, `handleRosterArchived`) follows this pattern and then calls the appropriate RPC to clean up mappings.

### Sync Pattern (both types)

1. Bot service polls via `rpc.GetUnprocessed*Events({ limit: 50 })` every 5 seconds
2. Processes each event (Discord REST calls with exponential retry)
3. Marks events as processed or failed
4. Mapping tables track the Discord resource ID for each domain entity

### Adding a New Sync Type

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
11. Add mock repository to all server test files

## Bot Localization

Discord's built-in `description_localizations` field on command definitions provides Czech translations. For dynamic response text, use the `Interaction` context tag from `dfx/Interactions/index`:

```typescript
import { Interaction } from 'dfx/Interactions/index';

Interaction.pipe(
  Effect.map((i) => {
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
