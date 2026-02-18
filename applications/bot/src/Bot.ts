import { runIx } from 'dfx/gateway';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect } from 'effect';

const PingCommand = Ix.global(
  {
    name: 'ping',
    description: 'Check if the bot is alive',
    description_localizations: { cs: 'Zkontrolovat, jestli bot žije' },
  },
  Interaction.pipe(
    Effect.map((i) => {
      const rawLocale = i.guild_locale ?? ('locale' in i ? i.locale : undefined);
      const locale = (rawLocale ?? 'en').startsWith('cs') ? 'cs' : 'en';
      return Ix.response({
        type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: locale === 'cs' ? 'Pong! Bot žije.' : 'Pong!' },
      });
    }),
  ),
);

const commands = Effect.succeed(Ix.builder.add(PingCommand));

export const program = commands.pipe(
  Effect.andThen(
    runIx((effect) =>
      Effect.catchAllCause(effect, (cause) => Effect.logError('Interaction error', cause)),
    ),
  ),
);
