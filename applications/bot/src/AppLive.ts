import { DiscordIxLive } from 'dfx/gateway';
import { Layer } from 'effect';
import { HealthServerLive } from '~/HealthServerLive.js';
import { RoleSyncService } from '~/services/RoleSyncService.js';

const SyncLive = RoleSyncService.Default.pipe(Layer.provide(DiscordIxLive));

export const AppLive = HealthServerLive.pipe(
  Layer.provideMerge(DiscordIxLive),
  Layer.provideMerge(SyncLive),
);
