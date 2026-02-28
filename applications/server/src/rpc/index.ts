import { SyncRpcs } from '@sideline/domain';
import { Effect } from 'effect';
import { ChannelsHandler } from './channel/index.js';
import { RolesHandler } from './role/index.js';

export const SyncRpcsLive = SyncRpcs.SyncRpcs.toLayer(
  Effect.Do.pipe(
    Effect.bind('roles', () => RolesHandler),
    Effect.bind('channels', () => ChannelsHandler),
    Effect.map(({ roles, channels }) => ({
      ...roles,
      ...channels,
    })),
  ),
);
