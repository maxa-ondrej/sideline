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

// --- Channel sync ---

export class UnprocessedChannelEvent extends Schema.Class<UnprocessedChannelEvent>(
  'UnprocessedChannelEvent',
)({
  id: Schema.String,
  team_id: Schema.String,
  guild_id: Schema.String,
  event_type: Schema.Literal(
    'channel_created',
    'channel_deleted',
    'member_added',
    'member_removed',
  ),
  subgroup_id: Schema.String,
  subgroup_name: Schema.NullOr(Schema.String),
  team_member_id: Schema.NullOr(Schema.String),
  discord_user_id: Schema.NullOr(Schema.String),
}) {}

export class ChannelMapping extends Schema.Class<ChannelMapping>('ChannelMapping')({
  id: Schema.String,
  team_id: Schema.String,
  subgroup_id: Schema.String,
  discord_channel_id: Schema.String,
}) {}

const GetUnprocessedChannelEvents = Rpc.make('GetUnprocessedChannelEvents', {
  payload: { limit: Schema.Number },
  success: Schema.Array(UnprocessedChannelEvent),
});

const MarkChannelEventProcessed = Rpc.make('MarkChannelEventProcessed', {
  payload: { id: Schema.String },
});

const MarkChannelEventFailed = Rpc.make('MarkChannelEventFailed', {
  payload: { id: Schema.String, error: Schema.String },
});

const GetMappingForSubgroup = Rpc.make('GetMappingForSubgroup', {
  payload: { team_id: Schema.String, subgroup_id: Schema.String },
  success: Schema.NullOr(ChannelMapping),
});

const UpsertChannelMapping = Rpc.make('UpsertChannelMapping', {
  payload: {
    team_id: Schema.String,
    subgroup_id: Schema.String,
    discord_channel_id: Schema.String,
  },
});

const DeleteChannelMapping = Rpc.make('DeleteChannelMapping', {
  payload: { team_id: Schema.String, subgroup_id: Schema.String },
});

export class RoleSyncRpcs extends RpcGroup.make(
  GetUnprocessedEvents,
  MarkEventProcessed,
  MarkEventFailed,
  GetMappingForRole,
  UpsertMapping,
  DeleteMapping,
  GetUnprocessedChannelEvents,
  MarkChannelEventProcessed,
  MarkChannelEventFailed,
  GetMappingForSubgroup,
  UpsertChannelMapping,
  DeleteChannelMapping,
) {}
