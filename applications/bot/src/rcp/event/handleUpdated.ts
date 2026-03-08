import type { EventRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option } from 'effect';
import { guildLocale } from '~/locale.js';
import { buildEventEmbed } from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { reorderChannelMessages } from './reorderChannelMessages.js';

export const handleUpdated = (event: EventRpcEvents.EventUpdatedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('stored', ({ rpc }) =>
      rpc['Event/GetDiscordMessageId']({ event_id: event.event_id }),
    ),
    Effect.bind('guild', ({ rest }) => rest.getGuild(event.guild_id)),
    Effect.flatMap(({ rpc, rest, stored, guild }) =>
      Option.match(stored, {
        onNone: () =>
          Effect.logWarning(
            `No Discord message stored for event ${event.event_id}, skipping update`,
          ),
        onSome: (msg) =>
          rpc['Event/GetRsvpCounts']({ event_id: event.event_id }).pipe(
            Effect.flatMap((counts) => {
              const locale = guildLocale({ guild_locale: guild.preferred_locale });
              const payload = buildEventEmbed({
                teamId: event.team_id,
                eventId: event.event_id,
                title: event.title,
                description: event.description,
                startAt: event.start_at,
                endAt: event.end_at,
                location: event.location,
                eventType: event.event_type,
                counts,
                locale,
              });
              return rest.updateMessage(msg.discord_channel_id, msg.discord_message_id, {
                embeds: payload.embeds,
                components: payload.components,
              });
            }),
            Effect.tap(() =>
              Effect.log(
                `Updated event message for "${event.title}" in channel ${msg.discord_channel_id}`,
              ),
            ),
            Effect.tap(() => {
              const locale = guildLocale({ guild_locale: guild.preferred_locale });
              return reorderChannelMessages(msg.discord_channel_id, locale);
            }),
            Effect.asVoid,
          ),
      }),
    ),
  );
