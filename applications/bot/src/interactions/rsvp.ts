import { Discord as DiscordSchemas, Event, EventRsvp, Team } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData, ModalSubmitData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Option, Schema } from 'effect';
import { type Locale, userLocale } from '~/locale.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const localizeRsvpResponse = (response: EventRsvp.RsvpResponse, locale: Locale): string => {
  switch (response) {
    case 'yes':
      return m.rsvp_yes({}, { locale });
    case 'no':
      return m.rsvp_no({}, { locale });
    case 'maybe':
      return m.rsvp_maybe({}, { locale });
  }
};

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);
const decodeEventId = Schema.decodeUnknownSync(Event.EventId);
const decodeTeamId = Schema.decodeUnknownSync(Team.TeamId);
const decodeRsvpResponse = Schema.decodeUnknownSync(EventRsvp.RsvpResponse);

export const RsvpButton = Ix.messageComponent(
  Ix.idStartsWith('rsvp:'),
  Effect.Do.pipe(
    Effect.bind('data', () => MessageComponentData),
    Effect.bind('interaction', () => Interaction),
    Effect.map(({ data, interaction }) => {
      const parts = data.custom_id.split(':');
      const teamId = parts[1];
      const eventId = parts[2];
      const response = decodeRsvpResponse(parts[3]);
      const locale = userLocale(interaction);
      return Ix.response({
        type: Discord.InteractionCallbackTypes.MODAL,
        data: {
          custom_id: `rsvp-modal:${teamId}:${eventId}:${response}`,
          title: m.bot_rsvp_modal_title(
            { response: localizeRsvpResponse(response, locale) },
            { locale },
          ),
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'rsvp_message',
                  label: m.bot_rsvp_modal_label({}, { locale }),
                  style: 2,
                  required: false,
                  max_length: 200,
                },
              ],
            },
          ],
        },
      });
    }),
  ),
);

const modalValueOption = (
  submission: Discord.APIModalSubmission,
  customId: string,
): Option.Option<string> => {
  for (const row of submission.components ?? []) {
    if (row.type !== 1) continue;
    for (const comp of row.components) {
      if (comp.custom_id === customId) {
        return comp.value && comp.value.trim().length > 0
          ? Option.some(comp.value.trim())
          : Option.none();
      }
    }
  }
  return Option.none();
};

export const RsvpModal = Ix.modalSubmit(
  Ix.idStartsWith('rsvp-modal:'),
  Effect.Do.pipe(
    Effect.bind('data', () => ModalSubmitData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.flatMap(({ data, interaction, rpc }) => {
      const parts = data.custom_id.split(':');
      const teamId = decodeTeamId(parts[1]);
      const eventId = decodeEventId(parts[2]);
      const response = decodeRsvpResponse(parts[3]);
      const message = modalValueOption(data, 'rsvp_message');
      const discordUserId = interactionUserId(interaction);
      const locale = userLocale(interaction);
      if (Option.isNone(discordUserId)) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: m.bot_rsvp_user_error({}, { locale }), flags: 64 },
          }),
        );
      }

      return rpc['Event/SubmitRsvp']({
        event_id: eventId,
        team_id: teamId,
        discord_user_id: decodeSnowflake(discordUserId.value),
        response,
        message,
      }).pipe(
        Effect.map(() =>
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_rsvp_recorded(
                { response: localizeRsvpResponse(response, locale) },
                { locale },
              ),
              flags: 64,
            },
          }),
        ),
        Effect.catchTag('RsvpDeadlinePassed', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_rsvp_deadline_passed({}, { locale }), flags: 64 },
            }),
          ),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_rsvp_not_member({}, { locale }), flags: 64 },
            }),
          ),
        ),
        Effect.catchTag('RsvpEventNotFound', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_rsvp_event_not_found({}, { locale }), flags: 64 },
            }),
          ),
        ),
      );
    }),
  ),
);
