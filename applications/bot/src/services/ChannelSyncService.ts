import type { RoleSyncRpc } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option, Schedule } from 'effect';
import { SyncRpc } from '~/services/SyncRpc.js';

const POLL_BATCH_SIZE = 50;

const retryPolicy = Schedule.exponential('1 second').pipe(Schedule.intersect(Schedule.recurs(3)));

/** Discord permission bits */
const VIEW_CHANNEL = 1024;
const SEND_MESSAGES = 2048;
const ALLOW_BITS = VIEW_CHANNEL | SEND_MESSAGES;

const makeChannelSyncService = Effect.Do.pipe(
  Effect.bind('rpc', () => SyncRpc),
  Effect.bind('rest', () => DiscordREST),
  Effect.let(
    'ensureMapping',
    ({ rpc, rest }) =>
      (teamId: string, subgroupId: string, guildId: string, subgroupName: string | null) =>
        Effect.Do.pipe(
          Effect.bind('existing', () =>
            rpc.GetMappingForSubgroup({ team_id: teamId, subgroup_id: subgroupId }),
          ),
          Effect.flatMap(({ existing }) => {
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
            const channelName = subgroupName ?? 'subgroup';
            return Effect.Do.pipe(
              // Create the channel (deny @everyone by default)
              Effect.bind('channel', () =>
                rest
                  .createGuildChannel(guildId, {
                    name: channelName,
                    type: 0,
                    permission_overwrites: [
                      {
                        id: guildId,
                        type: 0,
                        deny: ALLOW_BITS,
                      },
                    ],
                  })
                  .pipe(
                    Effect.retry(retryPolicy),
                    Effect.tap((created) =>
                      Effect.log(
                        `Auto-created Discord channel "${channelName}" (${created.id}) in guild ${guildId}`,
                      ),
                    ),
                  ),
              ),
              // Create a role for this channel
              Effect.bind('role', () =>
                rest.createGuildRole(guildId, { name: channelName }).pipe(
                  Effect.retry(retryPolicy),
                  Effect.tap((created) =>
                    Effect.log(
                      `Auto-created Discord role "${channelName}" (${created.id}) in guild ${guildId}`,
                    ),
                  ),
                ),
              ),
              // Set the role as a permission overwrite on the channel
              Effect.tap(({ channel, role }) =>
                rest
                  .setChannelPermissionOverwrite(channel.id, role.id, {
                    type: 0,
                    allow: ALLOW_BITS,
                  })
                  .pipe(
                    Effect.retry(retryPolicy),
                    Effect.tap(() =>
                      Effect.log(
                        `Set role ${role.id} permission overwrite on channel ${channel.id}`,
                      ),
                    ),
                  ),
              ),
              // Persist the mapping
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
            );
          }),
        ),
  ),
  Effect.let(
    'processEvent',
    ({ rpc, rest, ensureMapping }) =>
      (event: RoleSyncRpc.UnprocessedChannelEvent) => {
        const action: Effect.Effect<void, unknown> = (() => {
          switch (event.event_type) {
            case 'channel_created':
              return ensureMapping(
                event.team_id,
                event.subgroup_id,
                event.guild_id,
                event.subgroup_name,
              ).pipe(
                Effect.tap(({ discord_channel_id }) =>
                  Effect.log(
                    `Synced channel_created: subgroup ${event.subgroup_id} → Discord channel ${discord_channel_id} in guild ${event.guild_id}`,
                  ),
                ),
                Effect.asVoid,
              );

            case 'channel_deleted':
              return rpc
                .GetMappingForSubgroup({
                  team_id: event.team_id,
                  subgroup_id: event.subgroup_id,
                })
                .pipe(
                  Effect.flatMap(
                    Option.match({
                      onNone: () =>
                        Effect.log(
                          `No mapping found for subgroup ${event.subgroup_id} in guild ${event.guild_id}, skipping delete`,
                        ),
                      onSome: (mapping) =>
                        Effect.Do.pipe(
                          // Delete the role (if it exists)
                          Effect.tap(() =>
                            Option.match(mapping.discord_role_id, {
                              onNone: () => Effect.void,
                              onSome: (roleId) =>
                                rest.deleteGuildRole(event.guild_id, roleId).pipe(
                                  Effect.retry(retryPolicy),
                                  Effect.tap(() =>
                                    Effect.log(
                                      `Deleted Discord role ${roleId} in guild ${event.guild_id}`,
                                    ),
                                  ),
                                ),
                            }),
                          ),
                          // Delete the channel
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
                          // Delete the mapping
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
                );

            case 'member_added': {
              if (event.discord_user_id === null) {
                return Effect.log(
                  `Skipping member_added for subgroup ${event.subgroup_id}: no discord_user_id`,
                );
              }
              const addUserId = event.discord_user_id;
              return ensureMapping(
                event.team_id,
                event.subgroup_id,
                event.guild_id,
                event.subgroup_name,
              ).pipe(
                Effect.flatMap(({ discord_role_id }) =>
                  rest.addGuildMemberRole(event.guild_id, addUserId, discord_role_id).pipe(
                    Effect.retry(retryPolicy),
                    Effect.tap(() =>
                      Effect.log(
                        `Assigned role ${discord_role_id} to user ${addUserId} in guild ${event.guild_id}`,
                      ),
                    ),
                  ),
                ),
              );
            }

            case 'member_removed': {
              if (event.discord_user_id === null) {
                return Effect.log(
                  `Skipping member_removed for subgroup ${event.subgroup_id}: no discord_user_id`,
                );
              }
              const removeUserId = event.discord_user_id;
              return rpc
                .GetMappingForSubgroup({
                  team_id: event.team_id,
                  subgroup_id: event.subgroup_id,
                })
                .pipe(
                  Effect.flatMap((mappingOpt) => {
                    const roleId = mappingOpt.pipe(Option.flatMap((m) => m.discord_role_id));
                    if (Option.isNone(roleId)) {
                      return Effect.log(
                        `No mapping found for subgroup ${event.subgroup_id}, skipping member_removed`,
                      );
                    }
                    return rest
                      .deleteGuildMemberRole(event.guild_id, removeUserId, roleId.value)
                      .pipe(
                        Effect.retry(retryPolicy),
                        Effect.tap(() =>
                          Effect.log(
                            `Removed role ${roleId.value} from user ${removeUserId} in guild ${event.guild_id}`,
                          ),
                        ),
                      );
                  }),
                );
            }
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
