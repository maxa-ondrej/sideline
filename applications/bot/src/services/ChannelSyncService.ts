import type { RoleSyncRpc } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Discord from 'dfx/types';
import { Effect, Option, Schedule } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';

const POLL_BATCH_SIZE = 50;

const retryPolicy = Schedule.exponential('1 second').pipe(Schedule.intersect(Schedule.recurs(3)));

const ALLOW_BITS = Number(Discord.Permissions.ViewChannel | Discord.Permissions.SendMessages);

const makeChannelSyncService = Effect.Do.pipe(
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('rest', () => DiscordREST),

  // Create a Discord channel + role pair and persist the mapping
  Effect.let(
    'createChannelWithRole',
    ({ rpc, rest }) =>
      (teamId: string, subgroupId: string, guildId: string, channelName: string) =>
        Effect.Do.pipe(
          Effect.bind('channel', () =>
            rest
              .createGuildChannel(guildId, {
                name: channelName,
                type: 0,
                permission_overwrites: [{ id: guildId, type: 0, deny: ALLOW_BITS }],
              })
              .pipe(
                Effect.retry(retryPolicy),
                Effect.tap((ch) =>
                  Effect.log(
                    `Auto-created Discord channel "${channelName}" (${ch.id}) in guild ${guildId}`,
                  ),
                ),
              ),
          ),
          Effect.bind('role', () =>
            rest.createGuildRole(guildId, { name: channelName }).pipe(
              Effect.retry(retryPolicy),
              Effect.tap((r) =>
                Effect.log(
                  `Auto-created Discord role "${channelName}" (${r.id}) in guild ${guildId}`,
                ),
              ),
            ),
          ),
          Effect.tap(({ channel, role }) =>
            rest
              .setChannelPermissionOverwrite(channel.id, role.id, { type: 0, allow: ALLOW_BITS })
              .pipe(
                Effect.retry(retryPolicy),
                Effect.tap(() =>
                  Effect.log(`Set role ${role.id} permission overwrite on channel ${channel.id}`),
                ),
              ),
          ),
          Effect.tap(({ channel, role }) =>
            rpc.UpsertChannelMapping({
              team_id: teamId,
              subgroup_id: subgroupId,
              discord_channel_id: channel.id,
              discord_role_id: role.id,
            }),
          ),
          Effect.map(({ channel, role }) => ({
            discord_channel_id: channel.id,
            discord_role_id: role.id,
          })),
        ),
  ),

  // Return existing mapping if complete, otherwise create channel + role
  Effect.let(
    'ensureMapping',
    ({ rpc, createChannelWithRole }) =>
      (teamId: string, subgroupId: string, guildId: string, subgroupName: string | null) =>
        rpc.GetMappingForSubgroup({ team_id: teamId, subgroup_id: subgroupId }).pipe(
          Effect.flatMap((existing) => {
            const cached = existing.pipe(
              Option.flatMap((e) =>
                Option.map(e.discord_role_id, (roleId) => ({
                  discord_channel_id: e.discord_channel_id,
                  discord_role_id: roleId,
                })),
              ),
            );
            if (Option.isSome(cached)) {
              return Effect.succeed(cached.value);
            }
            return createChannelWithRole(teamId, subgroupId, guildId, subgroupName ?? 'subgroup');
          }),
        ),
  ),

  // --- Event handlers ---

  Effect.let(
    'handleChannelCreated',
    ({ ensureMapping }) =>
      (event: RoleSyncRpc.UnprocessedChannelEvent) =>
        ensureMapping(event.team_id, event.subgroup_id, event.guild_id, event.subgroup_name).pipe(
          Effect.tap(({ discord_channel_id }) =>
            Effect.log(
              `Synced channel_created: subgroup ${event.subgroup_id} → Discord channel ${discord_channel_id} in guild ${event.guild_id}`,
            ),
          ),
          Effect.asVoid,
        ),
  ),

  Effect.let(
    'handleChannelDeleted',
    ({ rpc, rest }) =>
      (event: RoleSyncRpc.UnprocessedChannelEvent) =>
        rpc.GetMappingForSubgroup({ team_id: event.team_id, subgroup_id: event.subgroup_id }).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.log(
                  `No mapping found for subgroup ${event.subgroup_id} in guild ${event.guild_id}, skipping delete`,
                ),
              onSome: (mapping) =>
                Effect.Do.pipe(
                  Effect.tap(() =>
                    Option.match(mapping.discord_role_id, {
                      onNone: () => Effect.void,
                      onSome: (roleId) =>
                        rest.deleteGuildRole(event.guild_id, roleId).pipe(
                          Effect.retry(retryPolicy),
                          Effect.tap(() =>
                            Effect.log(`Deleted Discord role ${roleId} in guild ${event.guild_id}`),
                          ),
                        ),
                    }),
                  ),
                  Effect.tap(() =>
                    rest.deleteChannel(mapping.discord_channel_id).pipe(
                      Effect.retry(retryPolicy),
                      Effect.tap(() =>
                        Effect.log(
                          `Deleted Discord channel ${mapping.discord_channel_id} in guild ${event.guild_id}`,
                        ),
                      ),
                    ),
                  ),
                  Effect.tap(() =>
                    rpc.DeleteChannelMapping({
                      team_id: event.team_id,
                      subgroup_id: event.subgroup_id,
                    }),
                  ),
                  Effect.asVoid,
                ),
            }),
          ),
        ),
  ),

  Effect.let(
    'handleMemberAdded',
    ({ rest, ensureMapping }) =>
      (event: RoleSyncRpc.UnprocessedChannelEvent) => {
        if (event.discord_user_id === null) {
          return Effect.log(
            `Skipping member_added for subgroup ${event.subgroup_id}: no discord_user_id`,
          );
        }
        const userId = event.discord_user_id;
        return ensureMapping(
          event.team_id,
          event.subgroup_id,
          event.guild_id,
          event.subgroup_name,
        ).pipe(
          Effect.flatMap(({ discord_role_id }) =>
            rest.addGuildMemberRole(event.guild_id, userId, discord_role_id).pipe(
              Effect.retry(retryPolicy),
              Effect.tap(() =>
                Effect.log(
                  `Assigned role ${discord_role_id} to user ${userId} in guild ${event.guild_id}`,
                ),
              ),
            ),
          ),
        );
      },
  ),

  Effect.let(
    'handleMemberRemoved',
    ({ rpc, rest }) =>
      (event: RoleSyncRpc.UnprocessedChannelEvent) => {
        if (event.discord_user_id === null) {
          return Effect.log(
            `Skipping member_removed for subgroup ${event.subgroup_id}: no discord_user_id`,
          );
        }
        const userId = event.discord_user_id;
        return rpc
          .GetMappingForSubgroup({ team_id: event.team_id, subgroup_id: event.subgroup_id })
          .pipe(
            Effect.flatMap((mappingOpt) => {
              const roleId = mappingOpt.pipe(Option.flatMap((m) => m.discord_role_id));
              if (Option.isNone(roleId)) {
                return Effect.log(
                  `No mapping found for subgroup ${event.subgroup_id}, skipping member_removed`,
                );
              }
              return rest.deleteGuildMemberRole(event.guild_id, userId, roleId.value).pipe(
                Effect.retry(retryPolicy),
                Effect.tap(() =>
                  Effect.log(
                    `Removed role ${roleId.value} from user ${userId} in guild ${event.guild_id}`,
                  ),
                ),
              );
            }),
          );
      },
  ),

  // Dispatch event to handler, then mark processed or failed
  Effect.let(
    'processEvent',
    ({ rpc, handleChannelCreated, handleChannelDeleted, handleMemberAdded, handleMemberRemoved }) =>
      (event: RoleSyncRpc.UnprocessedChannelEvent) => {
        const action: Effect.Effect<void, unknown> = (() => {
          switch (event.event_type) {
            case 'channel_created':
              return handleChannelCreated(event);
            case 'channel_deleted':
              return handleChannelDeleted(event);
            case 'member_added':
              return handleMemberAdded(event);
            case 'member_removed':
              return handleMemberRemoved(event);
          }
        })();

        return action.pipe(
          Effect.flatMap(() => rpc.MarkChannelEventProcessed({ id: event.id })),
          Effect.catchAll((error) =>
            rpc
              .MarkChannelEventFailed({ id: event.id, error: String(error) })
              .pipe(
                Effect.tap(() =>
                  Effect.logWarning(`Failed to process channel sync event ${event.id}`, error),
                ),
              ),
          ),
        );
      },
  ),

  Effect.tap(() => Effect.logDebug('ChannelSyncService initialized')),
  Effect.let('processTick', ({ rpc, processEvent }) =>
    rpc.GetUnprocessedChannelEvents({ limit: POLL_BATCH_SIZE }).pipe(
      Effect.tap((events) => Effect.logDebug(`Channel sync poll: ${events.length} event(s)`)),
      Effect.flatMap((events) =>
        events.length === 0
          ? Effect.void
          : Effect.all(events.map(processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.log(`Processed ${events.length} channel sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.catchAll((error) => Effect.logWarning('Error polling channel sync events', error)),
    ),
  ),
  Effect.map(({ processTick }) => ({ processTick })),
);

export class ChannelSyncService extends Effect.Service<ChannelSyncService>()(
  'bot/ChannelSyncService',
  {
    effect: makeChannelSyncService,
  },
) {
  poll() {
    return this.processTick;
  }

  pollLoop() {
    return this.processTick.pipe(Effect.repeat(Schedule.spaced('5 seconds')));
  }
}
