import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric, pipe } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildPendingRsvpEmbed, PAGE_SIZE } from '~/rest/events/buildPendingRsvpEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const PendingRsvpPageButton = Ix.messageComponent(
  Ix.idStartsWith('pending-rsvp-page:'),
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
      const offset = Number(parts[3]) || 0;
      const locale = userLocale(interaction);
      const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;

      if (!discordUserId) {
        return Effect.succeed(
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_event_pending_not_member({}, { locale }),
              flags: DiscordTypes.MessageFlags.Ephemeral,
            },
          }),
        );
      }

      const work = rpc['Event/GetPendingRsvps']({
        guild_id: Discord.Snowflake.make(guildId),
        discord_user_id: Discord.Snowflake.make(discordUserId),
        offset,
        limit: PAGE_SIZE,
      }).pipe(
        Effect.map((result) => {
          const payload = buildPendingRsvpEmbed({
            events: result.events,
            total: result.total,
            offset,
            guildId,
            discordUserId,
            locale,
          });
          return { embeds: payload.embeds, components: payload.components };
        }),
        Effect.catchTag('GuildNotFound', () =>
          Effect.succeed({ content: m.bot_event_pending_not_member({}, { locale }) }),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          Effect.succeed({ content: m.bot_event_pending_not_member({}, { locale }) }),
        ),
        Effect.catchTag('RpcClientError', () =>
          Effect.succeed({ content: m.bot_event_pending_error({}, { locale }) }),
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
          (error) => Effect.logError('Failed to update pending rsvp page response', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        }),
      );
    }),
    Effect.withSpan('interaction/pending-rsvp-page'),
  ),
);
