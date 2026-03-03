import { Rpc, RpcGroup } from '@effect/rpc';
import { Schema } from 'effect';
import { Discord } from '~/index.js';

export const GuildRpcGroup = RpcGroup.make(
  Rpc.make('RegisterGuild', {
    payload: { guild_id: Discord.Snowflake, guild_name: Schema.String },
  }),
  Rpc.make('UnregisterGuild', {
    payload: { guild_id: Discord.Snowflake },
  }),
  Rpc.make('IsGuildRegistered', {
    payload: { guild_id: Discord.Snowflake },
    success: Schema.Boolean,
  }),
  Rpc.make('SyncGuildChannels', {
    payload: {
      guild_id: Discord.Snowflake,
      channels: Schema.Array(
        Schema.Struct({
          channel_id: Discord.Snowflake,
          name: Schema.String,
          type: Schema.Number,
          parent_id: Schema.NullOr(Discord.Snowflake),
        }),
      ),
    },
  }),
).prefix('Guild/');
