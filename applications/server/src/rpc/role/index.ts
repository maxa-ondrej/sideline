import {
  type Discord,
  type Role,
  RoleRpcGroup,
  RoleRpcModels,
  type RoleSyncEvent,
  type Team,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Array, Data, Effect, Either, flow, Option } from 'effect';
import { DiscordRoleMappingRepository } from '~/repositories/DiscordRoleMappingRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { constructEvent, EventPropertyMissing } from './events.js';

class NoChanges extends Data.TaggedError('NoChanges')<{
  count: 0;
}> {
  static make = () => new NoChanges({ count: 0 });
}

export const RolesRpcLive = Effect.Do.pipe(
  Effect.bind('syncEvents', () => RoleSyncEventsRepository),
  Effect.bind('mappings', () => DiscordRoleMappingRepository),
  Effect.let(
    'Role/GetUnprocessedEvents',
    ({ syncEvents }) =>
      ({ limit }: { readonly limit: number }) =>
        syncEvents.findUnprocessed(limit).pipe(
          Effect.orDie,
          Effect.map(
            Array.map(
              flow(
                constructEvent,
                Effect.tapError(Effect.logError),
                Effect.tapErrorTag('EventPropertyMissing', EventPropertyMissing.handle),
                Effect.either,
              ),
            ),
          ),
          Effect.tap(
            flow(
              Array.isEmptyReadonlyArray,
              Effect.if({
                onTrue: NoChanges.make,
                onFalse: () => Effect.void,
              }),
            ),
          ),
          Effect.tap((events) =>
            Effect.logInfo(`Collected ${events.length} role events from database.`),
          ),
          Effect.flatMap(Effect.all),
          Effect.tap(flow(Array.filterMap(Either.getLeft), Array.map(Effect.logError), Effect.all)),
          Effect.map(Array.filterMap(Either.getRight)),
          Effect.tap((events) =>
            Effect.logInfo(`Successfully mapped ${events.length} role events from database.`),
          ),
          Effect.catchTag('NoChanges', () => Effect.succeed(Array.empty())),
        ),
  ),
  Effect.let(
    'Role/MarkEventProcessed',
    ({ syncEvents }) =>
      ({ id }: { readonly id: RoleSyncEvent.RoleSyncEventId }) =>
        syncEvents.markProcessed(id).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Role/MarkEventFailed',
    ({ syncEvents }) =>
      ({ id, error }: { readonly id: RoleSyncEvent.RoleSyncEventId; readonly error: string }) =>
        syncEvents.markFailed(id, error).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Role/GetMapping',
    ({ mappings }) =>
      ({ team_id, role_id }: { readonly team_id: Team.TeamId; readonly role_id: Role.RoleId }) =>
        mappings.findByRoleId(team_id, role_id).pipe(
          Effect.map(
            Option.map(
              (m) =>
                new RoleRpcModels.RoleMapping({
                  id: m.id,
                  team_id: m.team_id,
                  role_id: m.role_id,
                  discord_role_id: m.discord_role_id,
                }),
            ),
          ),
          Effect.catchAll(() => Effect.succeed(Option.none())),
        ),
  ),
  Effect.let(
    'Role/UpsertMapping',
    ({ mappings }) =>
      ({
        team_id,
        role_id,
        discord_role_id,
      }: {
        readonly team_id: Team.TeamId;
        readonly role_id: Role.RoleId;
        readonly discord_role_id: Discord.Snowflake;
      }) =>
        mappings.insert(team_id, role_id, discord_role_id).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Role/DeleteMapping',
    ({ mappings }) =>
      ({ team_id, role_id }: { readonly team_id: Team.TeamId; readonly role_id: Role.RoleId }) =>
        mappings.deleteByRoleId(team_id, role_id).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Bind.remove('syncEvents'),
  Bind.remove('mappings'),
  (handlers) => RoleRpcGroup.RoleRpcGroup.toLayer(handlers),
);
