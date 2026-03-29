import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric, pipe } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildEventListEmbed, PAGE_SIZE } from '~/rest/events/buildEventListEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const EventListPageButton = Ix.messageComponent(
  Ix.idStartsWith('event-list-page:'),
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
      const guildId = parts[1];
      const offset = Number(parts[2]) || 0;
      const locale = userLocale(interaction);

      const work = rpc['Event/GetUpcomingGuildEvents']({
        guild_id: Discord.Snowflake.make(guildId),
        offset,
        limit: PAGE_SIZE,
      }).pipe(
        Effect.map((result) => {
          const payload = buildEventListEmbed({
            events: result.events,
            total: result.total,
            offset,
            guildId,
            locale,
          });
          return { embeds: payload.embeds, components: payload.components };
        }),
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
          (error) => Effect.logError('Failed to update event list page response', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        }),
      );
    }),
    Effect.withSpan('interaction/event-list-page'),
  ),
);
