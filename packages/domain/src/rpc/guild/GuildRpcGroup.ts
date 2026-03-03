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
).prefix('Guild/');
