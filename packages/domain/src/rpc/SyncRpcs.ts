import { RpcGroup } from '@effect/rpc';
import { ChannelRpcGroup } from './channel/ChannelRpcGroup.js';
import { EventRpcGroup } from './event/EventRpcGroup.js';
import { GuildRpcGroup } from './guild/GuildRpcGroup.js';
import { RoleRpcGroup } from './role/RoleRpcGroup.js';

export class SyncRpcs extends RpcGroup.make().merge(
  RoleRpcGroup,
  ChannelRpcGroup,
  GuildRpcGroup,
  EventRpcGroup,
) {}
