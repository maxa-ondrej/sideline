import { DiscordIxLive } from 'dfx/gateway';
import { Layer } from 'effect';
import { HealthServerLive } from '~/HealthServerLive.js';
import { ChannelSyncService, RoleSyncService } from '~/rcp/index.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const SyncLive = Layer.mergeAll(RoleSyncService.Default, ChannelSyncService.Default).pipe(
  Layer.provide(SyncRpc.Default),
  Layer.provide(DiscordIxLive),
);

export const AppLive = HealthServerLive.pipe(
  Layer.provideMerge(DiscordIxLive),
  Layer.provideMerge(SyncLive),
);
