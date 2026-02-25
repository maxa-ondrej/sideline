import type {
  Role as RoleNS,
  RoleSyncEvent as RoleSyncEventNS,
  Team as TeamNS,
} from '@sideline/domain';
import { RoleSyncRpc } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { DiscordRoleMappingRepository } from '~/repositories/DiscordRoleMappingRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';

export const RoleSyncRpcLive = RoleSyncRpc.RoleSyncRpcs.toLayer(
  Effect.Do.pipe(
    Effect.bind('syncEvents', () => RoleSyncEventsRepository),
    Effect.bind('mappings', () => DiscordRoleMappingRepository),
    Effect.map(({ syncEvents, mappings }) => ({
      GetUnprocessedEvents: ({ limit }: { readonly limit: number }) =>
        syncEvents.findUnprocessed(limit).pipe(
          Effect.map((rows) =>
            rows.map(
              (r) =>
                new RoleSyncRpc.UnprocessedEvent({
                  id: r.id,
                  team_id: r.team_id,
                  guild_id: r.guild_id,
                  event_type: r.event_type,
                  role_id: r.role_id,
                  role_name: r.role_name,
                  team_member_id: r.team_member_id,
                  discord_user_id: r.discord_user_id,
                }),
            ),
          ),
          Effect.catchAll(() => Effect.succeed([])),
        ),

      MarkEventProcessed: ({ id }: { readonly id: string }) =>
        syncEvents
          .markProcessed(id as RoleSyncEventNS.RoleSyncEventId)
          .pipe(Effect.catchAll(() => Effect.void)),

      MarkEventFailed: ({ id, error }: { readonly id: string; readonly error: string }) =>
        syncEvents
          .markFailed(id as RoleSyncEventNS.RoleSyncEventId, error)
          .pipe(Effect.catchAll(() => Effect.void)),

      GetMappingForRole: ({
        team_id,
        role_id,
      }: {
        readonly team_id: string;
        readonly role_id: string;
      }) =>
        mappings.findByRoleId(team_id as TeamNS.TeamId, role_id as RoleNS.RoleId).pipe(
          Effect.map(
            Option.match({
              onNone: () => null,
              onSome: (m) =>
                new RoleSyncRpc.RoleMapping({
                  id: m.id,
                  team_id: m.team_id,
                  role_id: m.role_id,
                  discord_role_id: m.discord_role_id,
                }),
            }),
          ),
          Effect.catchAll(() => Effect.succeed(null)),
        ),

      UpsertMapping: ({
        team_id,
        role_id,
        discord_role_id,
      }: {
        readonly team_id: string;
        readonly role_id: string;
        readonly discord_role_id: string;
      }) =>
        mappings
          .insert(team_id as TeamNS.TeamId, role_id as RoleNS.RoleId, discord_role_id)
          .pipe(Effect.catchAll(() => Effect.void)),

      DeleteMapping: ({
        team_id,
        role_id,
      }: {
        readonly team_id: string;
        readonly role_id: string;
      }) =>
        mappings
          .deleteByRoleId(team_id as TeamNS.TeamId, role_id as RoleNS.RoleId)
          .pipe(Effect.catchAll(() => Effect.void)),
    })),
  ),
);
