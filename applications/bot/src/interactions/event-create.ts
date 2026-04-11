import { Discord as DiscordSchemas, Event, TrainingType } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, ModalSubmitData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Metric, Option, pipe, Schema } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);
const decodeEventType = Schema.decodeUnknownSync(Event.EventType);
const decodeTrainingTypeId = Schema.decodeUnknownSync(TrainingType.TrainingTypeId);

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
    Effect.tap(() =>
      Metric.update(pipe(discordInteractionsTotal, Metric.tagged('interaction_type', 'modal')), 1),
    ),
    Effect.bind('data', () => ModalSubmitData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.flatMap(({ data, interaction, rpc, rest }) => {
      const isValidUuid = (s: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

      const parts = data.custom_id.split(':');
      const eventType = parts[1] ?? 'other';
      const rawTrainingTypeId =
        parts[2] && parts[2].length > 0 && isValidUuid(parts[2])
          ? Option.some(decodeTrainingTypeId(parts[2]))
          : Option.none<TrainingType.TrainingTypeId>();
      const locale = userLocale(interaction);

      const discordUserId = interactionUserId(interaction);
      const guildId = interaction.guild_id;

      if (!guildId) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_event_no_guild({}, { locale }),
              flags: Discord.MessageFlags.Ephemeral,
            },
          }),
        );
      }

      if (Option.isNone(discordUserId)) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_event_error({}, { locale }),
              flags: Discord.MessageFlags.Ephemeral,
            },
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
            data: {
              content: m.bot_event_invalid_date({}, { locale }),
              flags: Discord.MessageFlags.Ephemeral,
            },
          }),
        );
      }

      const decodedEventType = decodeEventType(eventType);
      const training_type_id =
        decodedEventType === 'training'
          ? rawTrainingTypeId
          : Option.none<TrainingType.TrainingTypeId>();

      const work = rpc['Event/CreateEvent']({
        guild_id: decodeSnowflake(guildId),
        discord_user_id: decodeSnowflake(discordUserId.value),
        event_type: decodedEventType,
        title: title.value,
        start_at: startAt.value,
        end_at: endAt,
        location,
        description,
        training_type_id,
      }).pipe(
        Effect.map((result) => m.bot_event_created({ title: result.title }, { locale })),
        Effect.catchTag('CreateEventNotMember', () =>
          Effect.succeed(m.bot_event_not_member({}, { locale })),
        ),
        Effect.catchTag('CreateEventForbidden', () =>
          Effect.succeed(m.bot_event_no_permission({}, { locale })),
        ),
        Effect.catchTag('CreateEventInvalidDate', () =>
          Effect.succeed(m.bot_event_invalid_date({}, { locale })),
        ),
        Effect.catchTag('RpcClientError', () => Effect.succeed(m.bot_event_error({}, { locale }))),
        Effect.flatMap((content) =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content },
          }),
        ),
        Effect.catchTag(
          'RequestError',
          'ResponseError',
          'RatelimitedResponse',
          'ErrorResponse',
          (error) => Effect.logError('Failed to update event create response', error),
        ),
      );

      const deferred: Discord.CreateMessageInteractionCallbackRequest = {
        type: Discord.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: Discord.MessageFlags.Ephemeral },
      };
      return Effect.as(Effect.forkDaemon(work), deferred);
    }),
    Effect.withSpan('interaction/event-create-modal'),
  ),
);
