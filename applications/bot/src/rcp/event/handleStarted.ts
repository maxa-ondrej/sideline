import type { EventRpcEvents } from '@sideline/domain';
import { DiscordREST } from 'dfx/DiscordREST';
import { Effect, Option } from 'effect';
import { guildLocale } from '~/locale.js';
import { buildEventEmbed, YES_EMBED_LIMIT } from '~/rest/events/buildEventEmbed.js';
import { SyncRpc } from '~/services/SyncRpc.js';

export const handleStarted = (event: EventRpcEvents.EventStartedEvent) =>
  Effect.Do.pipe(
    Effect.bind('rpc', () => SyncRpc),
    Effect.bind('rest', () => DiscordREST),
    Effect.bind('stored', ({ rpc }) =>
      rpc['Event/GetDiscordMessageId']({ event_id: event.event_id }),
    ),
    Effect.flatMap(({ rpc, rest, stored }) =>
      Option.match(stored, {
        onNone: () =>
          Effect.logWarning(
            `No Discord message stored for event ${event.event_id}, skipping started`,
          ),
        onSome: (msg) =>
          Effect.all({
            counts: rpc['Event/GetRsvpCounts']({ event_id: event.event_id }),
            embedInfo: rpc['Event/GetEventEmbedInfo']({ event_id: event.event_id }),
            yesAttendees: rpc['Event/GetYesAttendeesForEmbed']({
              event_id: event.event_id,
              limit: YES_EMBED_LIMIT,
            }),
            guild: rest.getGuild(event.guild_id),
          }).pipe(
            Effect.flatMap(({ counts, embedInfo, yesAttendees, guild }) =>
              Option.match(embedInfo, {
                onNone: () =>
                  Effect.logWarning(
                    `Event ${event.event_id} not found when building started embed`,
                  ),
                onSome: (info) => {
                  const locale = guildLocale({ guild_locale: guild.preferred_locale });
                  const payload = buildEventEmbed({
                    teamId: event.team_id,
                    eventId: event.event_id,
                    title: info.title,
                    description: info.description,
                    startAt: info.start_at,
                    endAt: info.end_at,
                    location: info.location,
                    eventType: info.event_type,
                    counts,
                    yesAttendees,
                    locale,
                    isStarted: true,
                  });
                  return rest
                    .updateMessage(msg.discord_channel_id, msg.discord_message_id, {
                      embeds: payload.embeds,
                      components: payload.components,
                    })
                    .pipe(
                      Effect.tap(() =>
                        Effect.logInfo(
                          `Marked event ${event.event_id} as started in channel ${msg.discord_channel_id}`,
                        ),
                      ),
                    );
                },
              }),
            ),
            Effect.asVoid,
          ),
      }),
    ),
  );
