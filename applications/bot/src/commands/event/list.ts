import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric, Option } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildUpcomingEventPage } from '~/rest/events/buildUpcomingEventEmbed.js';
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
          limit: 1,
        }).pipe(
          Effect.map((result) => {
            if (result.total === 0) {
              return { content: m.bot_upcoming_no_events({}, { locale }) };
            }
            const entry = result.events[0];
            if (!entry) {
              return { content: m.bot_upcoming_no_events({}, { locale }) };
            }
            const page = buildUpcomingEventPage({
              entry,
              currentIndex: 0,
              total: result.total,
              locale,
            });
            return { embeds: page.embeds, components: page.components };
          }),
          Effect.catchTag('GuildNotFound', () =>
            Effect.succeed({ content: m.bot_event_not_member({}, { locale }) }),
          ),
          Effect.catchTag('RsvpMemberNotFound', () =>
            Effect.succeed({ content: m.bot_event_not_member({}, { locale }) }),
          ),
          Effect.catchTag('RpcClientError', () =>
            Effect.succeed({ content: m.bot_event_list_error({}, { locale }) }),
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
            (error) => Effect.logError('Failed to update event list response', error),
          ),
        ),
      ),
    );

    return Effect.as(
      Effect.forkDaemon(work),
      Ix.response({
        type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: m.bot_thinking({}, { locale }),
          flags: DiscordTypes.MessageFlags.Ephemeral,
        },
      }),
    );
  }),
  Effect.withSpan('command/event/list'),
);
