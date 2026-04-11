import { Discord as DiscordSchemas, Event, EventRsvp, Team } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData, ModalSubmitData } from 'dfx/Interactions/index';
import * as Discord from 'dfx/types';
import { Effect, Metric, Option, pipe, Schema } from 'effect';
import { type Locale, userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildUpcomingEventEmbed } from '~/rest/events/buildUpcomingEventEmbed.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { postRsvpDiscordUpdates } from './rsvp.js';

const decodeSnowflake = Schema.decodeUnknownSync(DiscordSchemas.Snowflake);
const decodeEventId = Schema.decodeUnknownSync(Event.EventId);
const decodeTeamId = Schema.decodeUnknownSync(Team.TeamId);
const decodeRsvpResponse = Schema.decodeUnknownSync(EventRsvp.RsvpResponse);

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

// Handles custom_id: upcoming-rsvp:<event_id>:<team_id>:<response>
export const UpcomingRsvpButton = Ix.messageComponent(
  Ix.idStartsWith('upcoming-rsvp:'),
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
      const eventId = decodeEventId(parts[1]);
      const teamId = decodeTeamId(parts[2]);
      const response = decodeRsvpResponse(parts[3]);
      const locale = userLocale(interaction);
      const discordUserIdOption = interactionUserId(interaction);
      const guildId = interaction.guild_id;

      if (Option.isNone(discordUserIdOption)) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_rsvp_user_error({}, { locale }),
              flags: Discord.MessageFlags.Ephemeral,
            },
          }),
        );
      }

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

      const discordUserId = discordUserIdOption.value;
      const snowflakeGuildId = DiscordSchemas.Snowflake.make(guildId);

      const work = rpc['Event/SubmitRsvp']({
        event_id: eventId,
        team_id: teamId,
        discord_user_id: discordUserId,
        response,
        message: Option.none(),
        clearMessage: false,
      }).pipe(
        Effect.tap((counts) =>
          postRsvpDiscordUpdates({
            interaction,
            rpc,
            rest,
            eventId,
            teamId,
            response,
            discordUserId,
            counts,
          }),
        ),
        Effect.flatMap(() =>
          rpc['Event/GetUpcomingEventsForUser']({
            guild_id: snowflakeGuildId,
            discord_user_id: discordUserId,
            offset: 0,
            limit: 10,
          }).pipe(
            Effect.map((result) => {
              const entry = result.events.find((e) => e.event_id === eventId);
              if (!entry) {
                return {
                  content: m.bot_rsvp_event_not_found({}, { locale }),
                  components: [] as ReadonlyArray<Discord.ActionRowComponentForMessageRequest>,
                };
              }
              const page = buildUpcomingEventEmbed({ entry, locale });
              return { embeds: page.embeds, components: page.components };
            }),
          ),
        ),
        Effect.flatMap((payload) =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload,
          }),
        ),
        Effect.catchTag('RsvpDeadlinePassed', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_deadline_passed({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_not_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpNotGroupMember', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_not_group_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpEventNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_event_not_found({}, { locale }) },
          }),
        ),
        Effect.catchTag('GuildNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_event_not_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RpcClientError', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_event_list_error({}, { locale }) },
          }),
        ),
        Effect.catchTag(
          'RequestError',
          'ResponseError',
          'RatelimitedResponse',
          'ErrorResponse',
          (error) => Effect.logError('Failed to handle upcoming RSVP button', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: Discord.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        }),
      );
    }),
    Effect.withSpan('interaction/upcoming-rsvp'),
  ),
);

// Handles custom_id: u-add-msg:<team_id>:<event_id>:<response>
export const UpcomingAddMessageButton = Ix.messageComponent(
  Ix.idStartsWith('u-add-msg:'),
  Effect.Do.pipe(
    Effect.tap(() =>
      Metric.update(pipe(discordInteractionsTotal, Metric.tagged('interaction_type', 'button')), 1),
    ),
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
          custom_id: `u-modal:${teamId}:${eventId}:${response}`,
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
    Effect.withSpan('interaction/upcoming-add-message-button'),
  ),
);

// Handles custom_id: u-clear-msg:<team_id>:<event_id>:<response>
export const UpcomingClearMessageButton = Ix.messageComponent(
  Ix.idStartsWith('u-clear-msg:'),
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
      const teamId = decodeTeamId(parts[1]);
      const eventId = decodeEventId(parts[2]);
      const response = decodeRsvpResponse(parts[3]);
      const discordUserIdOption = interactionUserId(interaction);
      const locale = userLocale(interaction);
      const guildId = interaction.guild_id;

      if (Option.isNone(discordUserIdOption)) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_rsvp_user_error({}, { locale }),
              flags: Discord.MessageFlags.Ephemeral,
            },
          }),
        );
      }

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

      const discordUserId = decodeSnowflake(discordUserIdOption.value);
      const snowflakeGuildId = DiscordSchemas.Snowflake.make(guildId);

      const work = rpc['Event/SubmitRsvp']({
        event_id: eventId,
        team_id: teamId,
        discord_user_id: discordUserId,
        response,
        message: Option.none(),
        clearMessage: true,
      }).pipe(
        Effect.tap((counts) =>
          postRsvpDiscordUpdates({
            interaction,
            rpc,
            rest,
            eventId,
            teamId,
            response,
            discordUserId,
            counts,
          }),
        ),
        Effect.flatMap(() =>
          rpc['Event/GetUpcomingEventsForUser']({
            guild_id: snowflakeGuildId,
            discord_user_id: discordUserId,
            offset: 0,
            limit: 10,
          }).pipe(
            Effect.map((result) => {
              const entry = result.events.find((e) => e.event_id === eventId);
              if (!entry) {
                return {
                  content: m.bot_rsvp_event_not_found({}, { locale }),
                  components: [] as ReadonlyArray<Discord.ActionRowComponentForMessageRequest>,
                };
              }
              const page = buildUpcomingEventEmbed({ entry, locale });
              return { embeds: page.embeds, components: page.components };
            }),
          ),
        ),
        Effect.flatMap((payload) =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload,
          }),
        ),
        Effect.catchTag('RsvpDeadlinePassed', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_deadline_passed({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_not_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpNotGroupMember', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_not_group_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpEventNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_event_not_found({}, { locale }) },
          }),
        ),
        Effect.catchTag('GuildNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_event_not_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RpcClientError', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_event_list_error({}, { locale }) },
          }),
        ),
        Effect.catchTag(
          'RequestError',
          'ResponseError',
          'RatelimitedResponse',
          'ErrorResponse',
          (error) => Effect.logError('Failed to handle upcoming clear-message button', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: Discord.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        }),
      );
    }),
    Effect.withSpan('interaction/upcoming-clear-message-button'),
  ),
);

// Handles custom_id: u-modal:<team_id>:<event_id>:<response>
export const UpcomingRsvpModal = Ix.modalSubmit(
  Ix.idStartsWith('u-modal:'),
  Effect.Do.pipe(
    Effect.tap(() =>
      Metric.update(pipe(discordInteractionsTotal, Metric.tagged('interaction_type', 'modal')), 1),
    ),
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
      const discordUserIdOption = interactionUserId(interaction);
      const locale = userLocale(interaction);
      const guildId = interaction.guild_id;

      if (Option.isNone(discordUserIdOption)) {
        return Effect.succeed(
          Ix.response({
            type: Discord.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_rsvp_user_error({}, { locale }),
              flags: Discord.MessageFlags.Ephemeral,
            },
          }),
        );
      }

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

      const discordUserId = decodeSnowflake(discordUserIdOption.value);
      const snowflakeGuildId = DiscordSchemas.Snowflake.make(guildId);

      const work = rpc['Event/SubmitRsvp']({
        event_id: eventId,
        team_id: teamId,
        discord_user_id: discordUserId,
        response,
        message,
        clearMessage: false,
      }).pipe(
        Effect.tap((counts) =>
          postRsvpDiscordUpdates({
            interaction,
            rpc,
            rest,
            eventId,
            teamId,
            response,
            discordUserId,
            counts,
          }),
        ),
        Effect.flatMap(() =>
          rpc['Event/GetUpcomingEventsForUser']({
            guild_id: snowflakeGuildId,
            discord_user_id: discordUserId,
            offset: 0,
            limit: 10,
          }).pipe(
            Effect.map((result) => {
              const entry = result.events.find((e) => e.event_id === eventId);
              if (!entry) {
                return {
                  content: m.bot_rsvp_event_not_found({}, { locale }),
                  components: [] as ReadonlyArray<Discord.ActionRowComponentForMessageRequest>,
                };
              }
              const page = buildUpcomingEventEmbed({ entry, locale });
              return { embeds: page.embeds, components: page.components };
            }),
          ),
        ),
        Effect.flatMap((payload) =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload,
          }),
        ),
        Effect.catchTag('RsvpDeadlinePassed', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_deadline_passed({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_not_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpNotGroupMember', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_not_group_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RsvpEventNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_rsvp_event_not_found({}, { locale }) },
          }),
        ),
        Effect.catchTag('GuildNotFound', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_event_not_member({}, { locale }) },
          }),
        ),
        Effect.catchTag('RpcClientError', () =>
          rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
            payload: { content: m.bot_event_list_error({}, { locale }) },
          }),
        ),
        Effect.catchTag(
          'RequestError',
          'ResponseError',
          'RatelimitedResponse',
          'ErrorResponse',
          (error) => Effect.logError('Failed to handle upcoming RSVP modal', error),
        ),
      );

      return Effect.as(
        Effect.forkDaemon(work),
        Ix.response({
          type: Discord.InteractionCallbackTypes.DEFERRED_UPDATE_MESSAGE,
        }),
      );
    }),
    Effect.withSpan('interaction/upcoming-rsvp-modal'),
  ),
);
