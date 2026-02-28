import { Rpc } from '@effect/rpc';
import { Schema } from 'effect';
import { ChannelSyncEvent, Discord, SubgroupModel, Team } from '~/index.js';
import { UnprocessedChannelEvent } from './ChannelRpcEvents.js';
import { ChannelMapping } from './ChannelRpcModels.js';

export const ChannelRpcGroup = [
  Rpc.make('Channel/GetUnprocessedEvents', {
    payload: { limit: Schema.Number },
    success: Schema.Array(UnprocessedChannelEvent),
  }),
  Rpc.make('Channel/MarkEventProcessed', {
    payload: { id: ChannelSyncEvent.ChannelSyncEventId },
  }),
  Rpc.make('Channel/MarkEventFailed', {
    payload: { id: ChannelSyncEvent.ChannelSyncEventId, error: Schema.String },
  }),
  Rpc.make('Channel/GetMapping', {
    payload: { team_id: Team.TeamId, subgroup_id: SubgroupModel.SubgroupId },
    success: Schema.Option(ChannelMapping),
  }),
  Rpc.make('Channel/UpsertMapping', {
    payload: {
      team_id: Team.TeamId,
      subgroup_id: SubgroupModel.SubgroupId,
      discord_channel_id: Discord.Snowflake,
      discord_role_id: Discord.Snowflake,
    },
  }),
  Rpc.make('Channel/DeleteMapping', {
    payload: { team_id: Team.TeamId, subgroup_id: SubgroupModel.SubgroupId },
  }),
];
