import { Rpc, RpcGroup } from '@effect/rpc';
import { Schema } from 'effect';

export class UnprocessedEvent extends Schema.Class<UnprocessedEvent>('UnprocessedEvent')({
  id: Schema.String,
  team_id: Schema.String,
  guild_id: Schema.String,
  event_type: Schema.Literal('role_assigned', 'role_unassigned', 'role_created', 'role_deleted'),
  role_id: Schema.String,
  role_name: Schema.NullOr(Schema.String),
  team_member_id: Schema.NullOr(Schema.String),
  discord_user_id: Schema.NullOr(Schema.String),
}) {}

export class RoleMapping extends Schema.Class<RoleMapping>('RoleMapping')({
  id: Schema.String,
  team_id: Schema.String,
  role_id: Schema.String,
  discord_role_id: Schema.String,
}) {}

const GetUnprocessedEvents = Rpc.make('GetUnprocessedEvents', {
  payload: { limit: Schema.Number },
  success: Schema.Array(UnprocessedEvent),
});

const MarkEventProcessed = Rpc.make('MarkEventProcessed', {
  payload: { id: Schema.String },
});

const MarkEventFailed = Rpc.make('MarkEventFailed', {
  payload: { id: Schema.String, error: Schema.String },
});

const GetMappingForRole = Rpc.make('GetMappingForRole', {
  payload: { team_id: Schema.String, role_id: Schema.String },
  success: Schema.NullOr(RoleMapping),
});

const UpsertMapping = Rpc.make('UpsertMapping', {
  payload: {
    team_id: Schema.String,
    role_id: Schema.String,
    discord_role_id: Schema.String,
  },
});

const DeleteMapping = Rpc.make('DeleteMapping', {
  payload: { team_id: Schema.String, role_id: Schema.String },
});

export class RoleSyncRpcs extends RpcGroup.make(
  GetUnprocessedEvents,
  MarkEventProcessed,
  MarkEventFailed,
  GetMappingForRole,
  UpsertMapping,
  DeleteMapping,
) {}
