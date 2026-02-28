import { RpcGroup } from '@effect/rpc';
import { ChannelRpcGroup } from './channel/index.js';
import { RoleRpcGroup } from './role/index.js';

export class SyncRpcs extends RpcGroup.make(...RoleRpcGroup, ...ChannelRpcGroup) {}
