import { Rpc, RpcGroup } from '@effect/rpc';
import { Schema } from 'effect';
import { ChannelSyncEvent, Discord, SubgroupModel, Team } from '~/index.js';
import { UnprocessedChannelEvent } from './ChannelRpcEvents.js';
import { ChannelMapping } from './ChannelRpcModels.js';

export const ChannelRpcGroup = RpcGroup.make(
  Rpc.make('GetUnprocessedEvents', {
    payload: { limit: Schema.Number },
    success: Schema.Array(UnprocessedChannelEvent),
  }),
  Rpc.make('MarkEventProcessed', {
    payload: { id: ChannelSyncEvent.ChannelSyncEventId },
  }),
  Rpc.make('MarkEventFailed', {
    payload: { id: ChannelSyncEvent.ChannelSyncEventId, error: Schema.String },
  }),
  Rpc.make('GetMapping', {
    payload: { team_id: Team.TeamId, subgroup_id: SubgroupModel.SubgroupId },
    success: Schema.OptionFromNullOr(ChannelMapping),
  }),
  Rpc.make('UpsertMapping', {
    payload: {
      team_id: Team.TeamId,
      subgroup_id: SubgroupModel.SubgroupId,
      discord_channel_id: Discord.Snowflake,
      discord_role_id: Discord.Snowflake,
    },
  }),
  Rpc.make('DeleteMapping', {
    payload: { team_id: Team.TeamId, subgroup_id: SubgroupModel.SubgroupId },
  }),
).prefix('Channel/');
