import { RpcClient } from '@effect/rpc';
import { RoleSyncRpc } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Schedule } from 'effect';

const POLL_BATCH_SIZE = 50;

const retryPolicy = Schedule.exponential('1 second').pipe(Schedule.intersect(Schedule.recurs(3)));

const makeRoleSyncService = Effect.Do.pipe(
  Effect.bind('rpc', () => RpcClient.make(RoleSyncRpc.RoleSyncRpcs)),
  Effect.bind('rest', () => DiscordREST),
  Effect.let(
    'ensureMapping',
    ({ rpc, rest }) =>
      (teamId: string, roleId: string, guildId: string, roleName: string | null) =>
        Effect.Do.pipe(
          Effect.bind('existing', () =>
            rpc.GetMappingForRole({ team_id: teamId, role_id: roleId }),
          ),
          Effect.flatMap(({ existing }) => {
            if (existing !== null) {
              return Effect.succeed(existing.discord_role_id);
            }
            return rest.createGuildRole(guildId, { name: roleName ?? undefined }).pipe(
              Effect.retry(retryPolicy),
              Effect.tap((created) =>
                Effect.log(
                  `Auto-created Discord role "${roleName}" (${created.id}) in guild ${guildId}`,
                ),
              ),
              Effect.flatMap((created) =>
                rpc
                  .UpsertMapping({
                    team_id: teamId,
                    role_id: roleId,
                    discord_role_id: created.id,
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
      (event: RoleSyncRpc.UnprocessedEvent) => {
        const action: Effect.Effect<void, unknown> = (() => {
          switch (event.event_type) {
            case 'role_created':
              return ensureMapping(
                event.team_id,
                event.role_id,
                event.guild_id,
                event.role_name,
              ).pipe(
                Effect.tap((discordRoleId) =>
                  Effect.log(
                    `Synced role_created: role ${event.role_id} → Discord role ${discordRoleId} in guild ${event.guild_id}`,
                  ),
                ),
                Effect.asVoid,
              );

            case 'role_deleted':
              return rpc.GetMappingForRole({ team_id: event.team_id, role_id: event.role_id }).pipe(
                Effect.flatMap((mapping) => {
                  if (mapping === null) {
                    return Effect.log(
                      `No mapping found for role ${event.role_id} in guild ${event.guild_id}, skipping delete`,
                    );
                  }
                  return rest.deleteGuildRole(event.guild_id, mapping.discord_role_id).pipe(
                    Effect.retry(retryPolicy),
                    Effect.tap(() =>
                      Effect.log(
                        `Deleted Discord role ${mapping.discord_role_id} in guild ${event.guild_id}`,
                      ),
                    ),
                    Effect.flatMap(() =>
                      rpc.DeleteMapping({
                        team_id: event.team_id,
                        role_id: event.role_id,
                      }),
                    ),
                  );
                }),
              );

            case 'role_assigned': {
              if (event.discord_user_id === null) {
                return Effect.log(
                  `Skipping role_assigned for role ${event.role_id}: no discord_user_id`,
                );
              }
              const assignUserId = event.discord_user_id;
              return ensureMapping(
                event.team_id,
                event.role_id,
                event.guild_id,
                event.role_name,
              ).pipe(
                Effect.flatMap((discordRoleId) =>
                  rest.addGuildMemberRole(event.guild_id, assignUserId, discordRoleId).pipe(
                    Effect.retry(retryPolicy),
                    Effect.tap(() =>
                      Effect.log(
                        `Assigned Discord role ${discordRoleId} to user ${assignUserId} in guild ${event.guild_id}`,
                      ),
                    ),
                  ),
                ),
              );
            }

            case 'role_unassigned': {
              if (event.discord_user_id === null) {
                return Effect.log(
                  `Skipping role_unassigned for role ${event.role_id}: no discord_user_id`,
                );
              }
              const unassignUserId = event.discord_user_id;
              return rpc.GetMappingForRole({ team_id: event.team_id, role_id: event.role_id }).pipe(
                Effect.flatMap((mapping) => {
                  if (mapping === null) {
                    return Effect.log(
                      `No mapping found for role ${event.role_id}, skipping unassign`,
                    );
                  }
                  return rest
                    .deleteGuildMemberRole(event.guild_id, unassignUserId, mapping.discord_role_id)
                    .pipe(
                      Effect.retry(retryPolicy),
                      Effect.tap(() =>
                        Effect.log(
                          `Removed Discord role ${mapping.discord_role_id} from user ${unassignUserId} in guild ${event.guild_id}`,
                        ),
                      ),
                    );
                }),
              );
            }
          }
        })();

        return action.pipe(
          Effect.flatMap(() => rpc.MarkEventProcessed({ id: event.id })),
          Effect.catchAll((error) =>
            rpc
              .MarkEventFailed({ id: event.id, error: String(error) })
              .pipe(
                Effect.tap(() =>
                  Effect.logWarning(`Failed to process sync event ${event.id}`, error),
                ),
              ),
          ),
        );
      },
  ),
  Effect.let('processTick', ({ rpc, processEvent }) =>
    rpc.GetUnprocessedEvents({ limit: POLL_BATCH_SIZE }).pipe(
      Effect.flatMap((events) =>
        events.length === 0
          ? Effect.void
          : Effect.all(events.map(processEvent), { concurrency: 1 }).pipe(
              Effect.tap(() => Effect.log(`Processed ${events.length} sync event(s)`)),
              Effect.asVoid,
            ),
      ),
      Effect.catchAll((error) => Effect.logWarning('Error polling sync events', error)),
    ),
  ),
  Effect.map(({ processTick }) => ({ processTick })),
);

export class RoleSyncService extends Effect.Service<RoleSyncService>()('bot/RoleSyncService', {
  scoped: makeRoleSyncService,
}) {
  poll() {
    return this.processTick;
  }

  pollLoop() {
    return this.processTick.pipe(Effect.repeat(Schedule.spaced('5 seconds')));
  }
}
