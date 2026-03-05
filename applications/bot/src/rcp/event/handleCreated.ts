import type { EventRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option } from 'effect';
import { guildLocale } from '~/locale.js';
import { buildEventEmbed } from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';
import { reorderChannelMessages } from './reorderChannelMessages.js';

export const handleCreated = (event: EventRpcEvents.EventCreatedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('counts', ({ rpc }) => rpc['Event/GetRsvpCounts']({ event_id: event.event_id })),
    Effect.bind('guild', ({ rest }) => rest.getGuild(event.guild_id)),
    Effect.flatMap(({ rpc, rest, counts, guild }) => {
      const channelId = event.discord_channel_id ?? guild.system_channel_id;
      if (!channelId) {
        return Effect.logWarning(
          `Guild ${event.guild_id} has no system channel, skipping event post`,
        );
      }
      const locale = guildLocale({ guild_locale: guild.preferred_locale });
      const payload = buildEventEmbed({
        teamId: event.team_id,
        eventId: event.event_id,
        title: event.title,
        description: Option.fromNullable(event.description),
        startAt: event.start_at,
        endAt: Option.fromNullable(event.end_at),
        location: Option.fromNullable(event.location),
        eventType: event.event_type,
        counts,
        locale,
      });
      return rest
        .createMessage(channelId, {
          embeds: payload.embeds,
          components: payload.components,
        })
        .pipe(
          Effect.tap((msg) =>
            rpc['Event/SaveDiscordMessageId']({
              event_id: event.event_id,
              discord_channel_id: channelId,
              discord_message_id: msg.id,
            }),
          ),
          Effect.tap((msg) =>
            Effect.log(`Posted event "${event.title}" to channel ${channelId}, message ${msg.id}`),
          ),
          Effect.tap(() => reorderChannelMessages(channelId, locale)),
          Effect.asVoid,
        );
    }),
  );
