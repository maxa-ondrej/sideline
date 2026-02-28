import { Rpc } from '@effect/rpc';
import { Schema } from 'effect';
import { Discord, Role, RoleSyncEvent, Team } from '~/index.js';
import { UnprocessedRoleEvent } from './RoleRpcEvents.js';
import { RoleMapping } from './RoleRpcModels.js';

export const RoleRpcGroup = [
  Rpc.make('Role/GetUnprocessedEvents', {
    payload: { limit: Schema.Number },
    success: Schema.Array(UnprocessedRoleEvent),
  }),
  Rpc.make('Role/MarkEventProcessed', {
    payload: { id: RoleSyncEvent.RoleSyncEventId },
  }),
  Rpc.make('Role/MarkEventFailed', {
    payload: { id: RoleSyncEvent.RoleSyncEventId, error: Schema.String },
  }),
  Rpc.make('Role/GetMapping', {
    payload: { team_id: Team.TeamId, role_id: Role.RoleId },
    success: Schema.Option(RoleMapping),
  }),
  Rpc.make('Role/UpsertMapping', {
    payload: {
      team_id: Team.TeamId,
      role_id: Role.RoleId,
      discord_role_id: Discord.Snowflake,
    },
  }),

  Rpc.make('Role/DeleteMapping', {
    payload: { team_id: Team.TeamId, role_id: Role.RoleId },
  }),
];
