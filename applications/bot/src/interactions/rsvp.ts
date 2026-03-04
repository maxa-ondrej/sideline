import { Discord as DiscordSchemas, Event, EventRsvp, Team } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData, ModalSubmitData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Option, Schema } from 'effect';
import { buildEventEmbed } from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);
const decodeEventId = Schema.decodeUnknownSync(Event.EventId);
const decodeTeamId = Schema.decodeUnknownSync(Team.TeamId);
const decodeRsvpResponse = Schema.decodeUnknownSync(EventRsvp.RsvpResponse);

export const RsvpButton = Ix.messageComponent(
  Ix.idStartsWith('rsvp:'),
  MessageComponentData.pipe(
    Effect.map((data) => {
      const parts = data.custom_id.split(':');
      const teamId = parts[1];
      const eventId = parts[2];
      const response = parts[3];
      return Ix.response({
        type: Discord.InteractionCallbackTypes.MODAL,
        data: {
          custom_id: `rsvp-modal:${teamId}:${eventId}:${response}`,
          title: `RSVP — ${response.charAt(0).toUpperCase() + response.slice(1)}`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  custom_id: 'rsvp_message',
                  label: 'Add a message (optional)',
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
): string | null => {
  for (const row of submission.components ?? []) {
    if (row.type !== 1) continue;
    for (const comp of row.components) {
      if (comp.custom_id === customId) {
        return comp.value && comp.value.trim().length > 0 ? comp.value.trim() : null;
      }
    }
  }
  return null;
};

export const RsvpModal = Ix.modalSubmit(
  Ix.idStartsWith('rsvp-modal:'),
  Effect.Do.pipe(
    Effect.bind('data', () => ModalSubmitData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.flatMap(({ data, interaction, rpc, rest }) => {
      const parts = data.custom_id.split(':');
      const teamId = decodeTeamId(parts[1]);
      const eventId = decodeEventId(parts[2]);
      const response = decodeRsvpResponse(parts[3]);
      const message = modalValueOption(data, 'rsvp_message');
      const discordUserId =
        interaction.member?.user?.id ?? ('user' in interaction ? interaction.user?.id : undefined);

      if (!discordUserId) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: 'Could not identify your Discord user.', flags: 64 },
          }),
        );
      }

      return rpc['Event/SubmitRsvp']({
        event_id: eventId,
        team_id: teamId,
        discord_user_id: decodeSnowflake(discordUserId),
        response,
        message,
      }).pipe(
        Effect.tap((counts) =>
          rpc['Event/GetDiscordMessageId']({ event_id: eventId }).pipe(
            Effect.flatMap((stored) =>
              Option.match(stored, {
                onNone: () => Effect.void,
                onSome: (msg) => {
                  const payload = buildEventEmbed({
                    teamId,
                    eventId,
                    title: '',
                    description: null,
                    startAt: '',
                    endAt: null,
                    location: null,
                    eventType: '',
                    counts,
                  });
                  return rest
                    .updateMessage(msg.discord_channel_id, msg.discord_message_id, {
                      embeds: undefined,
                      components: payload.components,
                    })
                    .pipe(
                      Effect.asVoid,
                      Effect.catchAll(() => Effect.void),
                    );
                },
              }),
            ),
          ),
        ),
        Effect.map(() =>
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Your RSVP (**${response}**) has been recorded!`,
              flags: 64,
            },
          }),
        ),
        Effect.catchTag('RsvpDeadlinePassed', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: 'RSVP deadline has passed.', flags: 64 },
            }),
          ),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: 'You are not a member of this team.', flags: 64 },
            }),
          ),
        ),
        Effect.catchTag('RsvpEventNotFound', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: 'Event not found.', flags: 64 },
            }),
          ),
        ),
      );
    }),
  ),
);
