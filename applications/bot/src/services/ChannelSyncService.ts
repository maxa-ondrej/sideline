import { RpcClient } from '@effect/rpc';
import { RoleSyncRpc } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Schedule } from 'effect';

const POLL_BATCH_SIZE = 50;

const retryPolicy = Schedule.exponential('1 second').pipe(Schedule.intersect(Schedule.recurs(3)));

/** Discord permission bits */
const VIEW_CHANNEL = 1024;
const SEND_MESSAGES = 2048;
const ALLOW_BITS = VIEW_CHANNEL | SEND_MESSAGES;

const makeChannelSyncService = Effect.Do.pipe(
  Effect.bind('rpc', () => RpcClient.make(RoleSyncRpc.RoleSyncRpcs)),
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
            if (existing !== null) {
              return Effect.succeed(existing.discord_channel_id);
            }
            return rest
              .createGuildChannel(guildId, {
                name: subgroupName ?? 'subgroup',
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
                    `Auto-created Discord channel "${subgroupName}" (${created.id}) in guild ${guildId}`,
                  ),
                ),
                Effect.flatMap((created) =>
                  rpc
                    .UpsertChannelMapping({
                      team_id: teamId,
                      subgroup_id: subgroupId,
                      discord_channel_id: created.id,
                    })
                    .pipe(Effect.map(() => created.id)),
                ),
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
                Effect.tap((discordChannelId) =>
                  Effect.log(
                    `Synced channel_created: subgroup ${event.subgroup_id} → Discord channel ${discordChannelId} in guild ${event.guild_id}`,
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
                  Effect.flatMap((mapping) => {
                    if (mapping === null) {
                      return Effect.log(
                        `No mapping found for subgroup ${event.subgroup_id} in guild ${event.guild_id}, skipping delete`,
                      );
                    }
                    return rest.deleteChannel(mapping.discord_channel_id).pipe(
                      Effect.retry(retryPolicy),
                      Effect.tap(() =>
                        Effect.log(
                          `Deleted Discord channel ${mapping.discord_channel_id} in guild ${event.guild_id}`,
                        ),
                      ),
                      Effect.flatMap(() =>
                        rpc.DeleteChannelMapping({
                          team_id: event.team_id,
                          subgroup_id: event.subgroup_id,
                        }),
                      ),
                    );
                  }),
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
                Effect.flatMap((discordChannelId) =>
                  rest
                    .setChannelPermissionOverwrite(discordChannelId, addUserId, {
                      type: 1,
                      allow: ALLOW_BITS,
                    })
                    .pipe(
                      Effect.retry(retryPolicy),
                      Effect.tap(() =>
                        Effect.log(
                          `Granted channel access to user ${addUserId} in channel ${discordChannelId}`,
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
                  Effect.flatMap((mapping) => {
                    if (mapping === null) {
                      return Effect.log(
                        `No mapping found for subgroup ${event.subgroup_id}, skipping member_removed`,
                      );
                    }
                    return rest
                      .deleteChannelPermissionOverwrite(mapping.discord_channel_id, removeUserId)
                      .pipe(
                        Effect.retry(retryPolicy),
                        Effect.tap(() =>
                          Effect.log(
                            `Revoked channel access from user ${removeUserId} in channel ${mapping.discord_channel_id}`,
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
  Effect.let('processTick', ({ rpc, processEvent }) =>
    rpc.GetUnprocessedChannelEvents({ limit: POLL_BATCH_SIZE }).pipe(
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
    scoped: makeChannelSyncService,
  },
) {
  poll() {
    return this.processTick;
  }

  pollLoop() {
    return this.processTick.pipe(Effect.repeat(Schedule.spaced('5 seconds')));
  }
}
