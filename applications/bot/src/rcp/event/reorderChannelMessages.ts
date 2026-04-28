import {
  type Discord,
  Discord as DiscordSchema,
  Event,
  type EventRpcModels,
} from '@sideline/domain';
import * as m from '@sideline/i18n/messages';
import { DiscordREST } from 'dfx/DiscordREST';
import type * as DiscordTypes from 'dfx/types';
import { Array as Arr, DateTime, Effect, Option, Order, Schema } from 'effect';
import type { Locale } from '~/locale.js';
import {
  buildCancelledEmbed,
  buildEventEmbed,
  YES_EMBED_LIMIT,
} from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

const decodeSnowflake = Schema.decodeEffect(DiscordSchema.Snowflake);

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
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.bind('counts', ({ rpc }) =>
      rpc['Event/GetRsvpCounts']({ event_id: Event.EventId.makeUnsafe(entry.event_id) }),
    ),
    Effect.bind('yesAttendees', ({ rpc }) =>
      rpc['Event/GetYesAttendeesForEmbed']({
        event_id: Event.EventId.makeUnsafe(entry.event_id),
        limit: YES_EMBED_LIMIT,
        member_group_id: Option.none(),
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
              event_id: Event.EventId.makeUnsafe(entry.event_id),
              discord_channel_id: channelId,
              discord_message_id: targetMessageId,
            }),
          ),
        );
    }),
    Effect.asVoid,
  );

export const sortEntriesForChannel = (
  entries: ReadonlyArray<EventRpcModels.ChannelEventEntry>,
  now: DateTime.Utc,
): Array<EventRpcModels.ChannelEventEntry> =>
  Arr.sort(
    entries,
    Order.make<EventRpcModels.ChannelEventEntry>((a, b) => {
      const aIsPast = DateTime.isLessThan(a.start_at, now);
      const bIsPast = DateTime.isLessThan(b.start_at, now);
      if (aIsPast && !bIsPast) return -1;
      if (!aIsPast && bIsPast) return 1;
      const timeOrder =
        aIsPast && bIsPast
          ? DateTime.Order(a.start_at, b.start_at)
          : DateTime.Order(b.start_at, a.start_at);
      if (timeOrder !== 0) return timeOrder;
      return a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0;
    }),
  );

const buildDividerEmbed = (
  locale: Locale,
): {
  embeds: ReadonlyArray<DiscordTypes.RichEmbed>;
  components: ReadonlyArray<DiscordTypes.ActionRowComponentForMessageRequest>;
} => ({
  embeds: [
    {
      description: m.bot_event_divider_past({}, { locale }),
      color: 0x2b2d31,
    },
  ],
  components: [],
});

export const reorderChannelMessages = (channelId: Discord.Snowflake, locale: Locale) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc.asEffect()),
    Effect.bind('rest', () => DiscordREST.asEffect()),
    Effect.bind('entries', ({ rpc }) =>
      rpc['Event/GetChannelEvents']({ discord_channel_id: channelId }),
    ),
    Effect.bind('existingDivider', ({ rpc }) =>
      rpc['Event/GetChannelDivider']({ discord_channel_id: channelId }),
    ),
    Effect.flatMap(({ rpc, rest, entries, existingDivider }) => {
      if (Arr.isReadonlyArrayEmpty(entries)) {
        return Option.match(existingDivider, {
          onNone: () => Effect.void,
          onSome: (dividerId) =>
            rest.deleteMessage(channelId, dividerId).pipe(
              Effect.tapError((e) =>
                Effect.logWarning(`Failed to delete divider message ${dividerId}`, e),
              ),
              Effect.catchTag('ErrorResponse', () => Effect.void),
              Effect.tap(() =>
                rpc['Event/DeleteChannelDivider']({ discord_channel_id: channelId }),
              ),
              Effect.asVoid,
            ),
        });
      }

      const now = DateTime.nowUnsafe();
      const sortedEntries = sortEntriesForChannel(entries, now);
      const hasPast = Arr.some(sortedEntries, (e) => DateTime.isLessThan(e.start_at, now));
      const hasFuture = Arr.some(sortedEntries, (e) => !DateTime.isLessThan(e.start_at, now));
      const needsDivider = hasPast && hasFuture;

      const getDividerId = needsDivider
        ? Option.match(existingDivider, {
            onNone: () =>
              rest.createMessage(channelId, buildDividerEmbed(locale)).pipe(
                Effect.flatMap((msg) => decodeSnowflake(msg.id)),
                Effect.tap((msgId) =>
                  rpc['Event/SaveChannelDivider']({
                    discord_channel_id: channelId,
                    discord_message_id: msgId,
                  }),
                ),
                Effect.map(Option.some),
                Effect.catchTag('ErrorResponse', (e) =>
                  Effect.logWarning('Failed to create divider message', e).pipe(
                    Effect.map(() => Option.none<Discord.Snowflake>()),
                  ),
                ),
                Effect.catchTag('SchemaError', (e) =>
                  Effect.logWarning('Failed to decode divider message id', e).pipe(
                    Effect.map(() => Option.none<Discord.Snowflake>()),
                  ),
                ),
              ),
            onSome: (id) => Effect.succeed(Option.some(id)),
          })
        : Option.match(existingDivider, {
            onNone: () => Effect.succeed(Option.none<Discord.Snowflake>()),
            onSome: (dividerId) =>
              rest.deleteMessage(channelId, dividerId).pipe(
                Effect.tapError((e) =>
                  Effect.logWarning(`Failed to delete divider message ${dividerId}`, e),
                ),
                Effect.catchTag('ErrorResponse', () => Effect.void),
                Effect.tap(() =>
                  rpc['Event/DeleteChannelDivider']({ discord_channel_id: channelId }),
                ),
                Effect.map(() => Option.none<Discord.Snowflake>()),
              ),
          });

      return getDividerId.pipe(
        Effect.flatMap((maybeDividerId) => {
          const pastIndex = Arr.findLastIndex(sortedEntries, (e) =>
            DateTime.isLessThan(e.start_at, now),
          );
          const dividerInsertIndex = Option.match(pastIndex, {
            onNone: () => 0,
            onSome: (i) => i + 1,
          });

          type ReorderItem =
            | { readonly _tag: 'event'; readonly entry: EventRpcModels.ChannelEventEntry }
            | { readonly _tag: 'divider' };

          const eventItems: Array<ReorderItem> = Arr.map(sortedEntries, (entry) => ({
            _tag: 'event' as const,
            entry,
          }));

          const items: Array<ReorderItem> = Option.match(maybeDividerId, {
            onNone: () => eventItems,
            onSome: () => [
              ...eventItems.slice(0, dividerInsertIndex),
              { _tag: 'divider' as const },
              ...eventItems.slice(dividerInsertIndex),
            ],
          });

          const allMessageIds = [
            ...Arr.map(entries, (e) => e.discord_message_id),
            ...Option.match(maybeDividerId, {
              onNone: () => Arr.empty<Discord.Snowflake>(),
              onSome: (id) => [id],
            }),
          ];
          const sortedMessageIds = sortSnowflakes(allMessageIds);

          const edits = Arr.getSomes(
            Arr.map(Arr.zip(items, sortedMessageIds), ([item, targetMessageId]) => {
              if (item._tag === 'divider') {
                return Option.map(maybeDividerId, (currentId) =>
                  rest.updateMessage(channelId, targetMessageId, buildDividerEmbed(locale)).pipe(
                    Effect.tap(() =>
                      currentId !== targetMessageId
                        ? rpc['Event/SaveChannelDivider']({
                            discord_channel_id: channelId,
                            discord_message_id: targetMessageId,
                          })
                        : Effect.void,
                    ),
                    Effect.tapError((e) =>
                      Effect.logWarning(
                        `Failed to update divider message at ${targetMessageId}`,
                        e,
                      ),
                    ),
                    Effect.catchTag('ErrorResponse', () => Effect.void),
                    Effect.asVoid,
                  ),
                );
              }
              return item.entry.discord_message_id !== targetMessageId
                ? Option.some(
                    editMessage(channelId, targetMessageId, item.entry, locale).pipe(
                      Effect.tapError((e) =>
                        Effect.logWarning(
                          `Failed to edit event message ${targetMessageId} in channel ${channelId}`,
                          e,
                        ),
                      ),
                      Effect.catchTag('ErrorResponse', () => Effect.void),
                    ),
                  )
                : Option.none();
            }),
          );

          if (Arr.isReadonlyArrayEmpty(edits)) return Effect.void;

          return Effect.all(edits, { concurrency: 1 }).pipe(
            Effect.tap(() =>
              Effect.logInfo(`Reordered ${Arr.length(edits)} message(s) in channel ${channelId}`),
            ),
            Effect.asVoid,
          );
        }),
      );
    }),
  );
