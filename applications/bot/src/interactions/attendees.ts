import { Event } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Schema } from 'effect';
import { userLocale } from '~/locale.js';
import { buildAttendeesEmbed } from '~/rest/events/buildAttendeesEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeEventId = Schema.decodeUnknownSync(Event.EventId);
const ATTENDEES_LIMIT = 15;

export const AttendeesButton = Ix.messageComponent(
  Ix.idStartsWith('attendees:'),
  Effect.Do.pipe(
    Effect.bind('data', () => MessageComponentData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.flatMap(({ data, interaction, rpc }) => {
      const parts = data.custom_id.split(':');
      const teamId = parts[1];
      const eventId = decodeEventId(parts[2]);
      const offset = Number(parts[3]) || 0;
      const locale = userLocale(interaction);

      return rpc['Event/GetRsvpAttendees']({
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
          return Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              embeds: payload.embeds,
              components: payload.components,
              flags: 64,
            },
          });
        }),
        Effect.catchAll(() =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_attendees_load_error({}, { locale }), flags: 64 },
            }),
          ),
        ),
      );
    }),
  ),
);

export const AttendeesPageButton = Ix.messageComponent(
  Ix.idStartsWith('attendees-page:'),
  Effect.Do.pipe(
    Effect.bind('data', () => MessageComponentData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.flatMap(({ data, interaction, rpc }) => {
      const parts = data.custom_id.split(':');
      const teamId = parts[1];
      const eventId = decodeEventId(parts[2]);
      const offset = Number(parts[3]) || 0;
      const locale = userLocale(interaction);

      return rpc['Event/GetRsvpAttendees']({
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
          return Ix.response({
            type: Discord.InteractionCallbackTypes.UPDATE_MESSAGE,
            data: {
              embeds: payload.embeds,
              components: payload.components,
            },
          });
        }),
        Effect.catchAll(() =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_attendees_load_error({}, { locale }), flags: 64 },
            }),
          ),
        ),
      );
    }),
  ),
);
