import { runIx } from 'dfx/gateway';
import { Effect } from 'effect';
import { commandBuilder } from '~/commands/index.js';
import { eventHandlers } from '~/events/index.js';
import { interactionBuilder } from '~/interactions/index.js';
import { ChannelSyncService, EventSyncService, RoleSyncService } from './index.js';

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
  Effect.bind('roles', () => RoleSyncService),
  Effect.bind('channels', () => ChannelSyncService),
  Effect.bind('eventSync', () => EventSyncService),
  Effect.tap(() => Effect.logInfo('Bot connected to Discord')),
  Effect.andThen(({ events, roles, channels, eventSync }) =>
    Effect.all(
      [ixProgram, ...events, roles.pollLoop(), channels.pollLoop(), eventSync.pollLoop()],
      {
        concurrency: 'unbounded',
      },
    ),
  ),
  Effect.asVoid,
);
