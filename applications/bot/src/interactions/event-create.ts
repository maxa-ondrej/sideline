import { Discord as DiscordSchemas } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, ModalSubmitData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Option, Schema } from 'effect';
import { userLocale } from '~/locale.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);

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

      const discordUserId = interactionUserId(interaction);
      const guildId = interaction.guild_id;

      if (!guildId) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: m.bot_event_no_guild({}, { locale }), flags: 64 },
          }),
        );
      }

      if (Option.isNone(discordUserId)) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: m.bot_event_error({}, { locale }), flags: 64 },
          }),
        );
      }

      const title = modalValueOption(data, 'event_title');
      const startAt = modalValueOption(data, 'event_start');
      const endAt = modalValueOption(data, 'event_end');
      const location = modalValueOption(data, 'event_location');
      const description = modalValueOption(data, 'event_description');

      if (Option.isNone(title) || Option.isNone(startAt)) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: m.bot_event_invalid_date({}, { locale }), flags: 64 },
          }),
        );
      }

      return rpc['Event/CreateEvent']({
        guild_id: decodeSnowflake(guildId),
        discord_user_id: decodeSnowflake(discordUserId.value),
        event_type: eventType as
          | 'training'
          | 'match'
          | 'tournament'
          | 'meeting'
          | 'social'
          | 'other',
        title: title.value,
        start_at: startAt.value,
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
        Effect.catchAll(() =>
          Effect.succeed(
            Ix.response({
              type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_event_error({}, { locale }), flags: 64 },
            }),
          ),
        ),
      );
    }),
  ),
);
