import { Rpc, RpcGroup } from '@effect/rpc';
import { Schema } from 'effect';
import { Discord, Role, RoleSyncEvent, Team } from '~/index.js';
import { UnprocessedRoleEvent } from './RoleRpcEvents.js';
import { RoleMapping } from './RoleRpcModels.js';

export const RoleRpcGroup = RpcGroup.make(
  Rpc.make('GetUnprocessedEvents', {
    payload: { limit: Schema.Number },
    success: Schema.Array(UnprocessedRoleEvent),
  }),
  Rpc.make('MarkEventProcessed', {
    payload: { id: RoleSyncEvent.RoleSyncEventId },
  }),
  Rpc.make('MarkEventFailed', {
    payload: { id: RoleSyncEvent.RoleSyncEventId, error: Schema.String },
  }),
  Rpc.make('GetMapping', {
    payload: { team_id: Team.TeamId, role_id: Role.RoleId },
    success: Schema.OptionFromNullOr(RoleMapping),
  }),
  Rpc.make('UpsertMapping', {
    payload: {
      team_id: Team.TeamId,
      role_id: Role.RoleId,
      discord_role_id: Discord.Snowflake,
    },
  }),

  Rpc.make('DeleteMapping', {
    payload: { team_id: Team.TeamId, role_id: Role.RoleId },
  }),
).prefix('Role/');
