import { runIx } from 'dfx/gateway';
import { Effect } from 'effect';
import { commandBuilder } from '~/commands/index.js';
import { eventHandlers } from '~/events/index.js';
import { interactionBuilder } from '~/interactions/index.js';

const ixProgram = Effect.succeed(commandBuilder.concat(interactionBuilder)).pipe(
  Effect.andThen(
    runIx((effect) =>
      Effect.catchAllCause(effect, (cause) => Effect.logError('Interaction error', cause)),
    ),
  ),
);

export const program = Effect.Do.pipe(
  Effect.bind('events', () => eventHandlers),
  Effect.tap(() => Effect.log('Bot connected to Discord')),
  Effect.andThen(({ events }) => Effect.all([ixProgram, ...events], { concurrency: 'unbounded' })),
  Effect.asVoid,
);
