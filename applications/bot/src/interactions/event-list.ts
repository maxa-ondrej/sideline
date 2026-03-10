import { Discord } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import * as Ix from 'dfx/Interactions/index';
import { Interaction, MessageComponentData } from 'dfx/Interactions/index';
import * as DiscordTypes from 'dfx/types';
import { Effect } from 'effect';
import { userLocale } from '~/locale.js';
import { buildEventListEmbed, PAGE_SIZE } from '~/rest/events/buildEventListEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const EventListPageButton = Ix.messageComponent(
  Ix.idStartsWith('event-list-page:'),
  Effect.Do.pipe(
    Effect.bind('data', () => MessageComponentData),
    Effect.bind('interaction', () => Interaction),
    Effect.bind('rpc', () => SyncRpc),
    Effect.flatMap(({ data, interaction, rpc }) => {
      const parts = data.custom_id.split(':');
      const guildId = parts[1];
      const offset = Number(parts[2]) || 0;
      const locale = userLocale(interaction);

      return rpc['Event/GetUpcomingGuildEvents']({
        guild_id: Discord.Snowflake.make(guildId),
        offset,
        limit: PAGE_SIZE,
      }).pipe(
        Effect.map((result) => {
          const payload = buildEventListEmbed({
            events: result.events,
            total: result.total,
            offset,
            guildId,
            locale,
          });
          return Ix.response({
            type: DiscordTypes.InteractionCallbackTypes.UPDATE_MESSAGE,
            data: {
              embeds: payload.embeds,
              components: payload.components,
            },
          });
        }),
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
