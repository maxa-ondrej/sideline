import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Metric } from 'effect';
import { userLocale } from '~/locale.js';
import { discordInteractionsTotal } from '~/metrics.js';
import { buildPendingRsvpEmbed, PAGE_SIZE } from '~/rest/events/buildPendingRsvpEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const pendingHandler = Interaction.pipe(
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
    const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;

    if (!discordUserId) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_event_pending_not_member({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    const snowflakeDiscordUserId = Discord.Snowflake.make(discordUserId);

    const work = Effect.Do.pipe(
      Effect.bind('rpc', () => SyncRpc),
      Effect.bind('rest', () => DiscordREST),
      Effect.flatMap(({ rpc, rest }) =>
        rpc['Event/GetPendingRsvps']({
          guild_id: snowflakeGuildId,
          discord_user_id: snowflakeDiscordUserId,
          offset: 0,
          limit: PAGE_SIZE,
        }).pipe(
          Effect.map((result) => {
            const payload = buildPendingRsvpEmbed({
              events: result.events,
              total: result.total,
              offset: 0,
              guildId,
              discordUserId,
              locale,
            });
            return {
              embeds: payload.embeds,
              components: payload.components,
            };
          }),
          Effect.catchTag('GuildNotFound', () =>
            Effect.succeed({ content: m.bot_event_pending_not_member({}, { locale }) }),
          ),
          Effect.catchTag('RsvpMemberNotFound', () =>
            Effect.succeed({ content: m.bot_event_pending_not_member({}, { locale }) }),
          ),
          Effect.catchTag('RpcClientError', () =>
            Effect.succeed({ content: m.bot_event_pending_error({}, { locale }) }),
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
            (error) => Effect.logError('Failed to update pending rsvp response', error),
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
  Effect.withSpan('command/event/pending'),
);
