import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric, Option, pipe } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildUpcomingEventPage } from '~/rest/events/buildUpcomingEventEmbed.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

// Handles upcoming-page:<offset> button clicks for the per-user upcoming events paginator
export const UpcomingPageButton = Ix.messageComponent(
  Ix.idStartsWith('upcoming-page:'),
  Effect.Do.pipe(
    Effect.tap(() =>
      Metric.update(pipe(discordInteractionsTotal, Metric.tagged('interaction_type', 'button')), 1),
    ),
    Effect.bind('data', () => MessageComponentData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.flatMap(({ data, interaction, rpc, rest }) => {
      const parts = data.custom_id.split(':');
      const parsedOffset = Number(parts[1]);
      const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.trunc(parsedOffset)) : 0;
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

      const work = rpc['Event/GetUpcomingEventsForUser']({
        guild_id: Discord.Snowflake.make(guildId),
        discord_user_id: discordUserId,
        offset,
        limit: 1,
      }).pipe(
        Effect.flatMap((result) => {
          if (!result.events[0] && result.total > 0) {
            return rpc['Event/GetUpcomingEventsForUser']({
              guild_id: Discord.Snowflake.make(guildId),
              discord_user_id: discordUserId,
              offset: 0,
              limit: 1,
            }).pipe(Effect.map((r) => ({ result: r, displayOffset: 0 })));
          }
          return Effect.succeed({ result, displayOffset: offset });
        }),
        Effect.map(({ result, displayOffset }) => {
          const entry = result.events[0];
          if (!entry) {
            return {
              content: m.bot_upcoming_no_events({}, { locale }),
              components: [],
            };
          }
          const page = buildUpcomingEventPage({
            entry,
            currentIndex: displayOffset,
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
          (error) => Effect.logError('Failed to update upcoming page response', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        }),
      );
    }),
    Effect.withSpan('interaction/upcoming-page'),
  ),
);
