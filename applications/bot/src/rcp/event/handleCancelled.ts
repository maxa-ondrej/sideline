import type { EventRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option } from 'effect';
import { guildLocale } from '~/locale.js';
import { buildCancelledEmbed } from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const handleCancelled = (event: EventRpcEvents.EventCancelledEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('stored', ({ rpc }) =>
      rpc['Event/GetDiscordMessageId']({ event_id: event.event_id }),
    ),
    Effect.bind('guild', ({ rest }) => rest.getGuild(event.guild_id)),
    Effect.flatMap(({ rest, stored, guild }) =>
      Option.match(stored, {
        onNone: () =>
          Effect.logWarning(
            `No Discord message stored for event ${event.event_id}, skipping cancel`,
          ),
        onSome: (msg) => {
          const locale = guildLocale({ guild_locale: guild.preferred_locale });
          const payload = buildCancelledEmbed('Event', locale);
          return rest
            .updateMessage(msg.discord_channel_id, msg.discord_message_id, {
              embeds: payload.embeds,
              components: payload.components,
            })
            .pipe(
              Effect.tap(() =>
                Effect.logInfo(
                  `Marked event ${event.event_id} as cancelled in channel ${msg.discord_channel_id}`,
                ),
              ),
              Effect.asVoid,
            );
        },
      }),
    ),
  );
