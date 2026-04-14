import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric, Option } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { sendUpcomingEventFollowups } from '~/rest/events/sendUpcomingEventFollowups.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

// Handles the "overview-show" button click — posts ephemeral upcoming events snapshot
export const OverviewShowButton = Ix.messageComponent(
  Ix.id('overview-show'),
  Effect.Do.pipe(
    Effect.tap(() =>
      Metric.update(
        Metric.withAttributes(discordInteractionsTotal, { interaction_type: 'button' }),
        1,
      ),
    ),
    Effect.bind('interaction', () => Interaction.asEffect()),
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.flatMap(({ interaction, rpc, rest }) => {
      const locale = userLocale(interaction);
      const discordUserIdOption = interactionUserId(interaction);
      const guildId = interaction.guild_id;

      if (!guildId) {
        return Effect.succeed(
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_event_no_guild({}, { locale }),
              flags: DiscordTypes.MessageFlags.Ephemeral,
            },
          }),
        );
      }

      if (Option.isNone(discordUserIdOption)) {
        return Effect.succeed(
          Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: m.bot_event_not_member({}, { locale }),
              flags: DiscordTypes.MessageFlags.Ephemeral,
            },
          }),
        );
      }

      const discordUserId = discordUserIdOption.value;
      const snowflakeGuildId = Discord.Snowflake.makeUnsafe(guildId);

      const work = rpc['Event/GetUpcomingEventsForUser']({
        guild_id: snowflakeGuildId,
        discord_user_id: discordUserId,
        offset: 0,
        limit: 10,
      }).pipe(
        Effect.flatMap((result) => {
          if (result.total === 0 || result.events.length === 0) {
            return rest
              .executeWebhook(interaction.application_id, interaction.token, {
                payload: {
                  content: m.bot_upcoming_no_events({}, { locale }),
                  flags: DiscordTypes.MessageFlags.Ephemeral,
                },
              })
              .pipe(Effect.asVoid);
          }
          return sendUpcomingEventFollowups({
            rest,
            applicationId: interaction.application_id,
            interactionToken: interaction.token,
            events: result.events,
            total: result.total,
            locale,
          });
        }),
        Effect.catchTag('GuildNotFound', () =>
          rest
            .executeWebhook(interaction.application_id, interaction.token, {
              payload: {
                content: m.bot_event_not_member({}, { locale }),
                flags: DiscordTypes.MessageFlags.Ephemeral,
              },
            })
            .pipe(Effect.asVoid),
        ),
        Effect.catchTag('RsvpMemberNotFound', () =>
          rest
            .executeWebhook(interaction.application_id, interaction.token, {
              payload: {
                content: m.bot_event_not_member({}, { locale }),
                flags: DiscordTypes.MessageFlags.Ephemeral,
              },
            })
            .pipe(Effect.asVoid),
        ),
        Effect.catchTag('RpcClientError', () =>
          rest
            .executeWebhook(interaction.application_id, interaction.token, {
              payload: {
                content: m.bot_event_list_error({}, { locale }),
                flags: DiscordTypes.MessageFlags.Ephemeral,
              },
            })
            .pipe(Effect.asVoid),
        ),
        Effect.catchTag(['HttpClientError', 'RatelimitedResponse', 'ErrorResponse'], (error) =>
          Effect.logError('Failed to handle overview-show button', error),
        ),
      );

      const deferredEphemeral: DiscordTypes.CreateMessageInteractionCallbackRequest = {
        type: DiscordTypes.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: { flags: DiscordTypes.MessageFlags.Ephemeral },
      };
      return Effect.as(Effect.forkDetach(work), deferredEphemeral);
    }),
    Effect.withSpan('interaction/overview-show'),
  ),
);
