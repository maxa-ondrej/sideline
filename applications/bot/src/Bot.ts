import type { DiscordREST } from 'dfx/DiscordREST';
import { type DiscordGateway, runIx } from 'dfx/gateway';
import { Effect, Schedule } from 'effect';
import { commandBuilder } from '~/commands/index.js';
import { eventHandlers } from '~/events/index.js';
import { interactionBuilder } from '~/interactions/index.js';
import type { SyncRpc } from '~/services/SyncRpc.js';
import { ChannelSyncService, EventSyncService, RoleSyncService } from './index.js';

const ixProgram = Effect.succeed(commandBuilder).pipe(
  Effect.map((cb) => cb.concat(interactionBuilder)),
  Effect.andThen(
    runIx((effect) =>
      // Top-level interaction error boundary — catches all causes including defects
      Effect.catchCause(effect, (cause) => Effect.logError('Interaction error', cause)),
    ),
  ),
);

const pollLoop = (processTick: Effect.Effect<void, unknown, unknown>) =>
  processTick.pipe(Effect.repeat(Schedule.spaced('5 seconds')));

export const program: Effect.Effect<
  void,
  unknown,
  DiscordGateway | DiscordREST | SyncRpc | RoleSyncService | ChannelSyncService | EventSyncService
> = Effect.Do.pipe(
  Effect.bind('events', () => eventHandlers),
  Effect.bind('roles', () => RoleSyncService.asEffect()),
  Effect.bind('channels', () => ChannelSyncService.asEffect()),
  Effect.bind('eventSync', () => EventSyncService.asEffect()),
  Effect.tap(() => Effect.logInfo('Bot connected to Discord')),
  Effect.andThen(({ events, roles, channels, eventSync }) =>
    Effect.all(
      [
        ixProgram,
        ...events,
        pollLoop(roles.processTick),
        pollLoop(channels.processTick),
        pollLoop(eventSync.processTick),
      ],
      {
        concurrency: 'unbounded',
      },
    ),
  ),
  Effect.asVoid,
);
