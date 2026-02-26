import { runIx } from 'dfx/gateway';
import { Effect } from 'effect';
import { commandBuilder } from '~/commands/index.js';
import { eventHandlers } from '~/events/index.js';
import { interactionBuilder } from '~/interactions/index.js';
import { ChannelSyncService } from '~/services/ChannelSyncService.js';
import { RoleSyncService } from '~/services/RoleSyncService.js';

const ixProgram = Effect.succeed(commandBuilder).pipe(
  Effect.map((cb) => cb.concat(interactionBuilder)),
  Effect.andThen(
    runIx((effect) =>
      Effect.catchAllCause(effect, (cause) => Effect.logError('Interaction error', cause)),
    ),
  ),
);

export const program = Effect.Do.pipe(
  Effect.bind('events', () => eventHandlers),
  Effect.bind('syncService', () => RoleSyncService),
  Effect.bind('channelSyncService', () => ChannelSyncService),
  Effect.tap(() => Effect.log('Bot connected to Discord')),
  Effect.andThen(({ events, syncService, channelSyncService }) =>
    Effect.all([ixProgram, ...events, syncService.pollLoop(), channelSyncService.pollLoop()], {
      concurrency: 'unbounded',
    }),
  ),
  Effect.asVoid,
);
