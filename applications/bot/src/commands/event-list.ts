import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import * as Ix from 'dfx/Interactions/index';
import { Interaction } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect } from 'effect';
import { userLocale } from '~/locale.js';
import { buildEventListEmbed, PAGE_SIZE } from '~/rest/events/buildEventListEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const EventListCommand = Ix.global(
  {
    name: 'event-list',
    description: 'List upcoming events',
    description_localizations: { cs: 'Zobrazit nadcházející události' },
  },
  Interaction.pipe(
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

      return Effect.Do.pipe(
        Effect.bind('rpc', () => SyncRpc),
        Effect.flatMap(({ rpc }) =>
          rpc['Event/GetUpcomingGuildEvents']({
            guild_id: snowflakeGuildId,
            offset: 0,
            limit: PAGE_SIZE,
          }),
        ),
        Effect.map((result) => {
          const payload = buildEventListEmbed({
            events: result.events,
            total: result.total,
            offset: 0,
            guildId,
            locale,
          });
          return Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              embeds: payload.embeds,
              components: payload.components,
              flags: 64,
            },
          });
        }),
        Effect.catchTag('GuildNotFound', () =>
          Effect.succeed(
            Ix.response({
              type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_event_not_member({}, { locale }), flags: 64 },
            }),
          ),
        ),
        Effect.catchAll(() =>
          Effect.succeed(
            Ix.response({
              type: DiscordTypes.InteractionCallbackTypes.CHANNEL_MESSAGE_WITH_SOURCE,
              data: { content: m.bot_event_list_error({}, { locale }), flags: 64 },
            }),
          ),
        ),
      );
    }),
  ),
);
