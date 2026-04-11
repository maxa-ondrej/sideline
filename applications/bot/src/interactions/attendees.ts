import { Event } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Metric, pipe, Schema } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildAttendeesEmbed } from '~/rest/events/buildAttendeesEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeEventId = Schema.decodeUnknownSync(Event.EventId);
const ATTENDEES_LIMIT = 15;

export const AttendeesButton = Ix.messageComponent(
  Ix.idStartsWith('attendees:'),
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
      const teamId = parts[1];
      const eventId = decodeEventId(parts[2]);
      const offset = Number(parts[3]) || 0;
      const locale = userLocale(interaction);

      const work = rpc['Event/GetRsvpAttendees']({
        event_id: eventId,
        offset,
        limit: ATTENDEES_LIMIT,
      }).pipe(
        Effect.map((result) => {
          const payload = buildAttendeesEmbed({
            attendees: result.attendees,
            total: result.total,
            offset,
            limit: ATTENDEES_LIMIT,
            teamId,
            eventId,
            locale,
          });
          return {
            embeds: payload.embeds,
            components: payload.components,
          };
        }),
        Effect.catchTag('RpcClientError', () =>
          Effect.succeed({ content: m.bot_attendees_load_error({}, { locale }) }),
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
          (error) => Effect.logError('Failed to update attendees response', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: Discord.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
          data: { flags: Discord.MessageFlags.Ephemeral },
        }),
      );
    }),
    Effect.withSpan('interaction/attendees'),
  ),
);

export const AttendeesPageButton = Ix.messageComponent(
  Ix.idStartsWith('attendees-page:'),
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
      const teamId = parts[1];
      const eventId = decodeEventId(parts[2]);
      const offset = Number(parts[3]) || 0;
      const locale = userLocale(interaction);

      const work = rpc['Event/GetRsvpAttendees']({
        event_id: eventId,
        offset,
        limit: ATTENDEES_LIMIT,
      }).pipe(
        Effect.map((result) => {
          const payload = buildAttendeesEmbed({
            attendees: result.attendees,
            total: result.total,
            offset,
            limit: ATTENDEES_LIMIT,
            teamId,
            eventId,
            locale,
          });
          return {
            embeds: payload.embeds,
            components: payload.components,
          };
        }),
        Effect.catchTag('RpcClientError', () =>
          Effect.succeed({ content: m.bot_attendees_load_error({}, { locale }) }),
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
          (error) => Effect.logError('Failed to update attendees page response', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: Discord.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        }),
      );
    }),
    Effect.withSpan('interaction/attendees-page'),
  ),
);
