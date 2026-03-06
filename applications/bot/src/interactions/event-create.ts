import { Discord as DiscordSchemas } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, ModalSubmitData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Schema } from 'effect';
import { userLocale } from '~/locale.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);

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

export const EventCreateModal = Ix.modalSubmit(
  Ix.idStartsWith('event-create:'),
  Effect.Do.pipe(
    Effect.bind('data', () => ModalSubmitData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.flatMap(({ data, interaction, rpc }) => {
      const parts = data.custom_id.split(':');
      const eventType = parts[1] ?? 'other';
      const locale = userLocale(interaction);

      const discordUserId =
        interaction.member?.user?.id ?? ('user' in interaction ? interaction.user?.id : undefined);
      const guildId = interaction.guild_id;

      if (!discordUserId || !guildId) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: m.bot_rsvp_user_error({}, { locale }), flags: 64 },
          }),
        );
      }

      const title = modalValueOption(data, 'event_title');
      const startAt = modalValueOption(data, 'event_start');
      const endAt = modalValueOption(data, 'event_end');
      const location = modalValueOption(data, 'event_location');
      const description = modalValueOption(data, 'event_description');

      if (!title || !startAt) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: m.bot_event_invalid_date({}, { locale }), flags: 64 },
          }),
        );
      }

      return rpc['Event/CreateEvent']({
        guild_id: guildId,
        discord_user_id: decodeSnowflake(discordUserId),
        event_type: eventType as
          | 'training'
          | 'match'
          | 'tournament'
          | 'meeting'
          | 'social'
          | 'other',
        title,
        start_at: startAt,
        end_at: endAt,
        location,
        description,
      }).pipe(
        Effect.map((result) =>
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_event_created({ title: result.title }, { locale }),
              flags: 64,
            },
          }),
        ),
        Effect.catchTag('CreateEventNotMember', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_event_not_member({}, { locale }), flags: 64 },
            }),
          ),
        ),
        Effect.catchTag('CreateEventForbidden', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_event_no_permission({}, { locale }), flags: 64 },
            }),
          ),
        ),
        Effect.catchTag('CreateEventInvalidDate', () =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_event_invalid_date({}, { locale }), flags: 64 },
            }),
          ),
        ),
      );
    }),
  ),
);
