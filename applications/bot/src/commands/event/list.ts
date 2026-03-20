import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect } from 'effect';
import { userLocale } from '~/locale.js';
import { buildEventListEmbed, PAGE_SIZE } from '~/rest/events/buildEventListEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const listHandler = Interaction.pipe(
  Effect.flatMap((interaction) => {
    const locale = userLocale(interaction);
    const guildId = interaction.guild_id;

    if (!guildId) {
      return Effect.succeed(
        Ix.response({
          type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
          data: { content: m.bot_event_no_guild({}, { locale }), flags: 64 },
        }),
      );
    }

    const snowflakeGuildId = Discord.Snowflake.make(guildId);

    const work = Effect.Do.pipe(
      Effect.bind('rpc', () => SyncRpc),
      Effect.bind('rest', () => DiscordREST),
      Effect.flatMap(({ rpc, rest }) =>
        rpc['Event/GetUpcomingGuildEvents']({
          guild_id: snowflakeGuildId,
          offset: 0,
          limit: PAGE_SIZE,
        }).pipe(
          Effect.map((result) => {
            const payload = buildEventListEmbed({
              events: result.events,
              total: result.total,
              offset: 0,
              guildId,
              locale,
            });
            return {
              embeds: payload.embeds,
              components: payload.components,
            };
          }),
          Effect.catchTag('GuildNotFound', () =>
            Effect.succeed({ content: m.bot_event_not_member({}, { locale }) }),
          ),
          Effect.catchAll(() =>
            Effect.succeed({ content: m.bot_event_list_error({}, { locale }) }),
          ),
          Effect.flatMap((payload) =>
            rest.updateOriginalWebhookMessage(interaction.application_id, interaction.token, {
              payload,
            }),
          ),
          Effect.catchAll((error) =>
            Effect.logError('Failed to update event list response', error),
          ),
        ),
      ),
    );

    return Effect.as(
      Effect.forkDaemon(work),
      Ix.response({
        type: DiscordTypes.InteractionCallbackTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      }),
    );
  }),
);
