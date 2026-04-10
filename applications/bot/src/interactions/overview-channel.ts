import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric, Option, pipe } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildUpcomingEventPage } from '~/rest/events/buildUpcomingEventEmbed.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

// Handles the "overview-show" button click — posts ephemeral upcoming events snapshot
export const OverviewShowButton = Ix.messageComponent(
  Ix.id('overview-show'),
  Effect.Do.pipe(
    Effect.tap(() =>
      Metric.update(pipe(discordInteractionsTotal, Metric.tagged('interaction_type', 'button')), 1),
    ),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.flatMap(({ interaction, rpc, rest }) => {
      const locale = userLocale(interaction);
      const discordUserIdOption = interactionUserId(interaction);
      const guildId = interaction.guild_id;

      if (!guildId) {
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

      if (Option.isNone(discordUserIdOption)) {
        return Effect.succeed(
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_event_not_member({}, { locale }),
              flags: DiscordTypes.MessageFlags.Ephemeral,
            },
          }),
        );
      }

      const discordUserId = discordUserIdOption.value;
      const snowflakeGuildId = Discord.Snowflake.make(guildId);

      const work = rpc['Event/GetUpcomingEventsForUser']({
        guild_id: snowflakeGuildId,
        discord_user_id: discordUserId,
        offset: 0,
        limit: 1,
      }).pipe(
        Effect.map((result) => {
          const entry = result.events[0];
          if (!entry || result.total === 0) {
            return { content: m.bot_upcoming_no_events({}, { locale }) };
          }
          const page = buildUpcomingEventPage({
            entry,
            currentIndex: 0,
            total: result.total,
            locale,
          });
          return { embeds: page.embeds, components: page.components };
        }),
        Effect.catchTag('GuildNotFound', () =>
          Effect.succeed({ content: m.bot_event_not_member({}, { locale }) }),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          Effect.succeed({ content: m.bot_event_not_member({}, { locale }) }),
        ),
        Effect.catchTag('RpcClientError', () =>
          Effect.succeed({ content: m.bot_event_list_error({}, { locale }) }),
        ),
        Effect.flatMap((payload) =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload,
          }),
        ),
        Effect.catchTag(
          'RequestError',
          'ResponseError',
          'RatelimitedResponse',
          'ErrorResponse',
          (error) => Effect.logError('Failed to handle overview-show button', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_thinking({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }),
    Effect.withSpan('interaction/overview-show'),
  ),
);
