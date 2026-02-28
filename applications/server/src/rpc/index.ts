import { Layer } from 'effect';
import { ChannelsRpcLive } from './channel/index.js';
import { RolesRpcLive } from './role/index.js';

export const SyncRpcsLive = Layer.merge(RolesRpcLive, ChannelsRpcLive);
