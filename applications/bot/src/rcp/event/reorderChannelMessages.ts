import { Event, type EventRpcModels } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect } from 'effect';
import type { Locale } from '~/locale.js';
import { buildCancelledEmbed, buildEventEmbed } from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const sortSnowflakes = (ids: ReadonlyArray<string>): Array<string> =>
  [...ids].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a < b ? -1 : a > b ? 1 : 0;
  });

const editMessage = (
  channelId: string,
  targetMessageId: string,
  entry: EventRpcModels.ChannelEventEntry,
  locale: Locale,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('counts', ({ rpc }) =>
      rpc['Event/GetRsvpCounts']({ event_id: Event.EventId.make(entry.event_id) }),
    ),
    Effect.flatMap(({ rpc, rest, counts }) => {
      const payload =
        entry.status === 'cancelled'
          ? buildCancelledEmbed(entry.title, locale)
          : buildEventEmbed({
              teamId: entry.team_id,
              eventId: entry.event_id,
              title: entry.title,
              description: entry.description,
              startAt: entry.start_at,
              endAt: entry.end_at,
              location: entry.location,
              eventType: entry.event_type,
              counts,
              locale,
            });
      return rest
        .updateMessage(channelId, targetMessageId, {
          embeds: payload.embeds,
          components: payload.components,
        })
        .pipe(
          Effect.tap(() =>
            rpc['Event/SaveDiscordMessageId']({
              event_id: Event.EventId.make(entry.event_id),
              discord_channel_id: channelId,
              discord_message_id: targetMessageId,
            }),
          ),
        );
    }),
    Effect.asVoid,
  );

export const reorderChannelMessages = (channelId: string, locale: Locale) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('entries', ({ rpc }) =>
      rpc['Event/GetChannelEvents']({ discord_channel_id: channelId }),
    ),
    Effect.flatMap(({ entries }) => {
      if (entries.length === 0) return Effect.void;

      const messageIds = entries.map((e) => e.discord_message_id);
      const sortedMessageIds = sortSnowflakes(messageIds);

      const edits: Array<Effect.Effect<void, unknown, SyncRpc | DiscordREST>> = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const targetMessageId = sortedMessageIds[i];
        if (entry.discord_message_id !== targetMessageId) {
          edits.push(editMessage(channelId, targetMessageId, entry, locale));
        }
      }

      if (edits.length === 0) return Effect.void;

      return Effect.all(edits, { concurrency: 1 }).pipe(
        Effect.tap(() =>
          Effect.log(`Reordered ${edits.length} message(s) in channel ${channelId}`),
        ),
        Effect.asVoid,
      );
    }),
  );
