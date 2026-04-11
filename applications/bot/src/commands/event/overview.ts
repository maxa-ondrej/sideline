import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';

const MANAGE_GUILD = 0x20n;

export const overviewHandler = Interaction.pipe(
  Effect.tap(() =>
    Metric.update(Metric.tagged(discordInteractionsTotal, 'interaction_type', 'command'), 1),
  ),
  Effect.flatMap((interaction) => {
    const locale = userLocale(interaction);
    const channelId = interaction.channel_id;

    const memberPermissions = interaction.member?.permissions;
    if (
      memberPermissions === undefined ||
      memberPermissions === null ||
      (BigInt(memberPermissions) & MANAGE_GUILD) === 0n
    ) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_event_overview_forbidden({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    if (!channelId) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_event_no_guild({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    const work = DiscordREST.pipe(
      Effect.flatMap((rest) =>
        rest
          .createMessage(channelId, {
            content: m.bot_overview_message({}, { locale }),
            components: [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 1,
                    label: m.bot_overview_button({}, { locale }),
                    custom_id: 'overview-show',
                  },
                ],
              },
            ],
          })
          .pipe(
            Effect.catchTag(
              'RequestError',
              'ResponseError',
              'RatelimitedResponse',
              'ErrorResponse',
              (error) => Effect.logError('Failed to post overview message', error),
            ),
          ),
      ),
    );

    return Effect.as(
      Effect.forkDaemon(work),
      Ix.response({
        type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: m.bot_overview_posted({}, { locale }),
          flags: DiscordTypes.MessageFlags.Ephemeral,
        },
      }),
    );
  }),
  Effect.withSpan('command/event/overview'),
);
