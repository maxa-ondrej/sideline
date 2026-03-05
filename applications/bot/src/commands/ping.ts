import * as m from '@sideline/i18n/messages';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect } from 'effect';
import { userLocale } from '~/locale.js';

export const PingCommand = Ix.global(
  {
    name: 'ping',
    description: 'Check if the bot is alive',
    description_localizations: { cs: 'Zkontrolovat, jestli bot žije' },
  },
  Interaction.pipe(
    Effect.map((i) => {
      const locale = userLocale(i);
      return Ix.response({
        type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: m.bot_ping({}, { locale }) },
      });
    }),
  ),
);
