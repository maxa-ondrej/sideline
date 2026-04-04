import { type Discord, Event, type EventRpcModels } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Array as Arr, Effect, Option } from 'effect';
import type { Locale } from '~/locale.js';
import {
  buildCancelledEmbed,
  buildEventEmbed,
  YES_EMBED_LIMIT,
} from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const sortSnowflakes = (ids: ReadonlyArray<Discord.Snowflake>): Array<Discord.Snowflake> =>
  [...ids].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a < b ? -1 : a > b ? 1 : 0;
  });

const editMessage = (
  channelId: Discord.Snowflake,
  targetMessageId: Discord.Snowflake,
  entry: EventRpcModels.ChannelEventEntry,
  locale: Locale,
) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('counts', ({ rpc }) =>
      rpc['Event/GetRsvpCounts']({ event_id: Event.EventId.make(entry.event_id) }),
    ),
    Effect.bind('yesAttendees', ({ rpc }) =>
      rpc['Event/GetYesAttendeesForEmbed']({
        event_id: Event.EventId.make(entry.event_id),
        limit: YES_EMBED_LIMIT,
      }),
    ),
    Effect.flatMap(({ rpc, rest, counts, yesAttendees }) => {
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
              yesAttendees,
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

export const reorderChannelMessages = (channelId: Discord.Snowflake, locale: Locale) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('entries', ({ rpc }) =>
      rpc['Event/GetChannelEvents']({ discord_channel_id: channelId }),
    ),
    Effect.flatMap(({ entries }) => {
      if (Arr.isEmptyReadonlyArray(entries)) return Effect.void;

      const messageIds = Arr.map(entries, (e) => e.discord_message_id);
      const sortedMessageIds = sortSnowflakes(messageIds);

      const edits = Arr.filterMap(
        Arr.zip(Arr.fromIterable(entries), sortedMessageIds),
        ([entry, targetMessageId]) =>
          entry.discord_message_id !== targetMessageId
            ? Option.some(editMessage(channelId, targetMessageId, entry, locale))
            : Option.none(),
      );

      if (Arr.isEmptyReadonlyArray(edits)) return Effect.void;

      return Effect.all(edits, { concurrency: 1 }).pipe(
        Effect.tap(() =>
          Effect.logInfo(`Reordered ${Arr.length(edits)} message(s) in channel ${channelId}`),
        ),
        Effect.asVoid,
      );
    }),
  );
