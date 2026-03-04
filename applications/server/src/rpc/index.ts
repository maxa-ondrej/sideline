import { Layer } from 'effect';
import { ChannelsRpcLive } from './channel/index.js';
import { EventsRpcLive } from './event/index.js';
import { GuildsRpcLive } from './guild/index.js';
import { RolesRpcLive } from './role/index.js';

export const SyncRpcsLive = Layer.mergeAll(
  RolesRpcLive,
  ChannelsRpcLive,
  GuildsRpcLive,
  EventsRpcLive,
);
