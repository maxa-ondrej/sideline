import { RpcGroup } from '@effect/rpc';
import { ChannelRpcGroup } from './channel/ChannelRpcGroup.js';
import { RoleRpcGroup } from './role/RoleRpcGroup.js';

export class SyncRpcs extends RpcGroup.make().merge(RoleRpcGroup, ChannelRpcGroup) {}
