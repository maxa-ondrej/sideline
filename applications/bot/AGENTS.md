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
├── commands/        — Slash command registry (event/create, event/list, event/pending, makanicko/*)
├── interactions/    — Component interaction registry (buttons/selects/modals)
├── events/          — Gateway event handler registry (guild, member, channel lifecycle)
├── services/        — Sync services (RoleSyncService, ChannelSyncService)
├── rcp/channel/     — Channel sync event handlers
│   ├── ProcessorService.ts    — Match.tag dispatcher for channel events
│   ├── channelUtils.ts        — Shared Discord helpers (deleteRole, deleteChannelAndRole)
│   ├── handleCreated.ts       — channel_created handler
│   ├── handleUpdated.ts       — channel_updated handler (rename channel + role, update role color)
│   ├── handleDeleted.ts       — channel_deleted handler
│   ├── handleArchived.ts      — channel_archived handler (archive or fallback to delete)
│   ├── handleMemberAdded.ts   — member_added handler
│   ├── handleMemberRemoved.ts — member_removed handler
│   └── handleRosterChannelCreated.ts — roster channel_created handler
└── rcp/event/       — Event sync event handlers
    ├── ProcessorService.ts    — Match.tag dispatcher for event sync events
    ├── handleCreated.ts       — event_created handler
    ├── handleUpdated.ts       — event_updated handler
    ├── handleCancelled.ts     — event_cancelled handler
    ├── handleStarted.ts       — event_started handler (updates embed, removes RSVP buttons)
    └── handleRsvpReminder.ts  — rsvp_reminder handler
└── rest/events/     — Embed builder functions
    ├── buildEventEmbed.ts         — Main event embed (RSVP counts, "Going" field)
    ├── buildAttendeesEmbed.ts     — Paginated attendee list embed
    ├── buildEventListEmbed.ts     — Paginated event list embed (/event list)
    └── buildPendingRsvpEmbed.ts   — Paginated pending RSVP embed (/event pending)
```

Follows the **AppLive + run.ts** pattern.

## Gateway Event Handlers (`src/events/index.ts`)

Gateway event handlers react to Discord gateway dispatch events (e.g. `GuildCreate`, `ChannelDelete`, `GuildMemberAdd`). All handlers are defined in `src/events/index.ts` and registered via `gateway.handleDispatch`.

### Pattern: Syncable Channel Events (ChannelCreate, ChannelDelete, ChannelUpdate)

These handlers sync Discord channel state to the server's `discord_channels` table via Guild RPCs. They follow a strict pattern:

1. Decode the raw payload with `decodeSyncableChannel(channel)` (returns `Option<DfxSyncableChannel>`)
2. `Option.match` on the result:
   - `onNone`: `Effect.logDebug('Skipping non-syncable channel event')` — silently skip unsupported channel types
   - `onSome`: execute the handler body
3. Handler body uses `Effect.Do.pipe`:
   - `Effect.tap` → increment `discordEventsTotal` metric with `event_type` tag
   - `Effect.tap` → `Effect.logInfo` with channel name, id, and guild_id
   - `Effect.tap` → call the appropriate Guild RPC (`Guild/UpsertChannel` for create/update, `Guild/DeleteChannel` for delete)
   - `Effect.catchTag('RpcClientError', (error) => Effect.logError(...))` — log and swallow RPC failures
   - `Effect.withSpan('discord/<event_name>', { attributes: { 'guild.id': channel.guild_id } })`
4. The `guild_id` comes from the raw `channel` payload (not the decoded struct), because the raw Discord payload includes `guild_id` at the top level

```typescript
// Example: ChannelCreate handler
Effect.let('channelCreate', ({ gateway, rpc }) =>
  gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.ChannelCreate, (channel) =>
    Option.match(decodeSyncableChannel(channel), {
      onNone: () => Effect.logDebug('Skipping non-syncable channel event'),
      onSome: (decoded) =>
        Effect.Do.pipe(
          Effect.tap(() =>
            Metric.update(pipe(discordEventsTotal, Metric.tagged('event_type', 'channel_create')), 1),
          ),
          Effect.tap(() => Effect.logInfo(`Channel created: ${decoded.name} (${decoded.id}) in guild ${channel.guild_id}`)),
          Effect.tap(() =>
            rpc['Guild/UpsertChannel']({
              guild_id: decodeSnowflake(channel.guild_id),
              channel_id: decoded.id,
              name: decoded.name,
              type: decoded.type,
              parent_id: decoded.parent_id,
            }),
          ),
          Effect.catchTag('RpcClientError', (error) =>
            Effect.logError(`Failed to upsert channel ${decoded.id}`, error),
          ),
          Effect.withSpan('discord/channel_create', {
            attributes: { 'guild.id': channel.guild_id },
          }),
        ),
    }),
  ),
),
```

### Adding a New Gateway Event Handler

1. Add an `Effect.let('<handlerName>', ({ gateway, rpc, rest }) => ...)` entry in the `eventHandlers` pipe
2. Use `gateway.handleDispatch(DiscordTypes.GatewayDispatchEvents.<Event>, (payload) => ...)` to register the handler
3. If the event payload needs schema validation, decode with `Schema.decodeUnknownOption` and use `Option.match` (see channel pattern above)
4. Always increment `discordEventsTotal` metric with `Metric.tagged('event_type', '<snake_case_name>')`
5. Always add `Effect.withSpan('discord/<event_name>', { attributes: { 'guild.id': ... } })`
6. Always catch expected errors (e.g. `RpcClientError`) with `Effect.catchTag` and log them — never let RPC failures crash the handler
7. Add the handler name to the destructuring in the final `Effect.map` and include it in the returned array
8. Add an `expect(registeredEvents).toContain(Discord.GatewayDispatchEvents.<Event>)` assertion in `test/events.test.ts` and update the `toHaveLength` count

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

Event types: `channel_created`, `channel_updated`, `channel_deleted`, `channel_archived`, `channel_detached`, `member_added`, `member_removed`

**Name fields on `channel_created` and `channel_updated` events**: The server pre-formats Discord names using team settings. Events carry separate `discord_channel_name` (for the Discord channel) and `discord_role_name` (for the Discord role). Bot handlers must use these fields instead of deriving names from `group_name` or `roster_name`. Exception: `member_added` handlers may fall back to `group_name` since the channel is normally already created by the `channel_created` event with the correct format. The `ensureMapping` and `createDiscordChannelAndRole` functions accept separate `channelName` and `roleName` parameters.

**Color field on `channel_created` and `channel_updated` events**: Events carry `discord_role_color` as `Option<number>` (Discord integer color). The server converts hex colors (e.g. `#FF0000`) to Discord integers before emitting. Bot handlers pass this value to `createRoleForChannel` or `updateGuildRole` as the `color` parameter.

#### Channel Update

When a group or roster name/emoji/color changes, the server emits `channel_updated`. The bot handler in `src/rcp/channel/handleUpdated.ts`:

1. Updates the Discord role via `updateGuildRole` (name + color)
2. Updates the Discord channel via `updateChannel` (name)
3. Calls `rpc['Guild/UpdateChannelName']` to sync the new channel name back to the `discord_channels` table on the server

Both `handleGroupChannelUpdated` and `handleRosterChannelUpdated` delegate to the same shared logic.

#### Channel Archival

When a team has `discord_archive_category_id` set, deleting a group or deactivating a roster emits `channel_archived` instead of `channel_deleted`. The bot handler in `src/rcp/channel/handleArchived.ts`:

1. Moves the Discord channel to the archive category via `updateChannel({ parent_id })`
2. Deletes the permission overwrite for the channel role
3. Deletes the Discord role
4. On any failure, falls back to full channel+role deletion (same as `channel_deleted`)

Each handler (`handleGroupArchived`, `handleRosterArchived`) follows this pattern and then calls the appropriate RPC to clean up mappings.

### Event Sync (events → Discord messages)

Syncs event lifecycle to Discord embed messages. When events are created/updated/cancelled/started, the server emits events to `event_sync_events`.

| Component | File |
|-----------|------|
| Domain model | `packages/domain/src/rpc/event/EventRpcEvents.ts` |
| Bot service | `src/rcp/event/ProcessorService.ts` |

Event types: `event_created`, `event_updated`, `event_cancelled`, `event_started`, `rsvp_reminder`

The `event_started` handler updates the Discord embed to remove RSVP buttons and rebuilds the embed with current RSVP counts.

### Sync Pattern (all types)

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

## Embed Display Conventions

### User Name Display in Embeds

All Discord embeds that display user/member names must use the **bold name + mention dual format**. This ensures reliable display on mobile clients where `<@id>` mentions sometimes fail to resolve.

| Scenario | Format | Example |
|----------|--------|---------|
| Name and discord_id both present | `**Name** (<@id>)` | `**Alice** (<@123>)` |
| Only discord_id present | `<@id>` | `<@123>` |
| Only name present | `**Name**` | `**Alice**` |
| Neither present | `Unknown` or `?` | `Unknown` |

This pattern is used in:
- `buildEventEmbed.ts` — "Going" field (bold name only, no mention, comma-separated)
- `buildAttendeesEmbed.ts` — attendee entries (`**Name** (<@id>)` with optional message)
- `handleRsvpReminder.ts` — non-responder and yes-attendee lists in reminder embeds

When building new embed functions that display user names, always follow this priority: bold name first, mention as parenthetical supplement.

### Paginated Embed Pattern

Commands that display paginated lists (`/event list`, `/event pending`, attendees) follow this structure:

1. Embed builder function in `src/rest/events/` exports a `PAGE_SIZE` constant and a `build*Embed` function
2. The builder returns `{ embeds, components }` where `components` contains Previous/Next buttons when `total > PAGE_SIZE`
3. Button `custom_id` format: `{prefix}:{guildId}:{userId?}:{offset}` — offset-based pagination
4. Previous button is disabled when `offset === 0`; Next button is disabled when `offset + PAGE_SIZE >= total`
5. The slash command handler sends an initial ephemeral "thinking" response, forks a background fiber, then updates the message
6. The page button interaction handler responds with `DEFERRED_UPDATE_MESSAGE` and edits in place
