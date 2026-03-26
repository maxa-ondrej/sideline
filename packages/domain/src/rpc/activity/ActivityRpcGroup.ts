import { Rpc, RpcGroup } from '@effect/rpc';
import { Schema } from 'effect';
import { ActivityLog, Discord } from '~/index.js';
import {
  ActivityGuildNotFound,
  ActivityMemberNotFound,
  GetStatsResult,
  LogActivityResult,
} from './ActivityRpcModels.js';

export const ActivityRpcGroup = RpcGroup.make(
  Rpc.make('LogActivity', {
    payload: {
      guild_id: Discord.Snowflake,
      discord_user_id: Discord.Snowflake,
      activity_type: ActivityLog.ActivityType,
      duration_minutes: Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
      note: Schema.OptionFromNullOr(Schema.String),
    },
    success: LogActivityResult,
    error: Schema.Union(ActivityMemberNotFound, ActivityGuildNotFound),
  }),
  Rpc.make('GetStats', {
    payload: {
      guild_id: Discord.Snowflake,
      discord_user_id: Discord.Snowflake,
    },
    success: GetStatsResult,
    error: Schema.Union(ActivityMemberNotFound, ActivityGuildNotFound),
  }),
).prefix('Activity/');
