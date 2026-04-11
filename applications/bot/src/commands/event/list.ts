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

export const listHandler = Interaction.pipe(
  Effect.tap(() =>
    Metric.update(Metric.tagged(discordInteractionsTotal, 'interaction_type', 'command'), 1),
  ),
  Effect.flatMap((interaction) => {
    const locale = userLocale(interaction);
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

    const snowflakeGuildId = Discord.Snowflake.make(guildId);
    const discordUserIdOption = interactionUserId(interaction);

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

    const snowflakeDiscordUserId = discordUserIdOption.value;

    const work = Effect.Do.pipe(
      Effect.bind('rpc', () => SyncRpc),
      Effect.bind('rest', () => DiscordREST),
      Effect.flatMap(({ rpc, rest }) =>
        rpc['Event/GetUpcomingEventsForUser']({
          guild_id: snowflakeGuildId,
          discord_user_id: snowflakeDiscordUserId,
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
          Effect.catchTag(
            'RequestError',
            'ResponseError',
            'RatelimitedResponse',
            'ErrorResponse',
            (error) => Effect.logError('Failed to update event list response', error),
          ),
        ),
      ),
    );

    const deferredEphemeral: DiscordTypes.CreateMessageInteractionCallbackRequest = {
      type: DiscordTypes.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: DiscordTypes.MessageFlags.Ephemeral },
    };
    return Effect.as(Effect.forkDaemon(work), deferredEphemeral);
  }),
  Effect.withSpan('command/event/list'),
);
