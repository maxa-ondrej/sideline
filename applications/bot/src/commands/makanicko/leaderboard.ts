import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect, Option } from 'effect';
import { userLocale } from '~/locale.js';
import { interactionUserId } from '~/schemas.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const leaderboardHandler = Interaction.pipe(
  Effect.flatMap((interaction) => {
    const locale = userLocale(interaction);
    const guildId = interaction.guild_id;

    if (!guildId) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_makanicko_no_guild({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    const snowflakeGuildId = Discord.Snowflake.make(guildId);
    const maybeUserId = interactionUserId(interaction);

    if (Option.isNone(maybeUserId)) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: m.bot_makanicko_leaderboard_error({}, { locale }),
            flags: DiscordTypes.MessageFlags.Ephemeral,
          },
        }),
      );
    }

    const discordUserId = maybeUserId.value;

    const work = Effect.Do.pipe(
      Effect.bind('rpc', () => SyncRpc),
      Effect.bind('rest', () => DiscordREST),
      Effect.flatMap(({ rpc, rest }) =>
        rpc['Activity/GetLeaderboard']({
          guild_id: snowflakeGuildId,
          discord_user_id: discordUserId,
          limit: Option.none(),
        }).pipe(
          Effect.map((result) => {
            if (result.entries.length === 0) {
              return {
                embeds: [
                  {
                    title: m.bot_makanicko_leaderboard_title({}, { locale }),
                    description: m.bot_makanicko_leaderboard_empty({}, { locale }),
                    color: 0x99aab5,
                  },
                ],
              };
            }

            const topEntries = result.entries.slice(0, 10);
            const description = topEntries
              .map((entry) =>
                m.bot_makanicko_leaderboard_entry(
                  { rank: entry.rank, username: entry.username, count: entry.total_activities },
                  { locale },
                ),
              )
              .join('\n');

            const footerText = Option.match(result.requesting_user_rank, {
              onNone: () => m.bot_makanicko_leaderboard_not_ranked({}, { locale }),
              onSome: (rank) => m.bot_makanicko_leaderboard_your_rank({ rank }, { locale }),
            });

            return {
              embeds: [
                {
                  title: m.bot_makanicko_leaderboard_title({}, { locale }),
                  description,
                  color: 0xf1c40f,
                  footer: {
                    text: `${footerText} | ${m.bot_makanicko_leaderboard_footer({}, { locale })}`,
                  },
                },
              ],
            };
          }),
          Effect.catchTag('ActivityGuildNotFound', () =>
            Effect.succeed({ content: m.bot_makanicko_leaderboard_error({}, { locale }) }),
          ),
          Effect.catchTag('ActivityMemberNotFound', () =>
            Effect.succeed({ content: m.bot_makanicko_log_not_member({}, { locale }) }),
          ),
          Effect.catchTag('RpcClientError', () =>
            Effect.succeed({ content: m.bot_makanicko_leaderboard_error({}, { locale }) }),
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
            (error) => Effect.logError('Failed to update makanicko leaderboard response', error),
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
);
