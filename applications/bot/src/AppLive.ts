import { DiscordIxLive } from 'dfx/gateway';
import { Layer } from 'effect';
import { HealthServerLive } from '~/HealthServerLive.js';

export const AppLive = HealthServerLive.pipe(Layer.provideMerge(DiscordIxLive));
