import { SqlClient, SqlSchema } from '@effect/sql';
import {
  type Discord,
  type Event,
  EventRpcGroup,
  EventRpcModels,
  type EventRsvp,
  type Team,
  TeamMember,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Array, Data, Effect, flow, Option, Schema } from 'effect';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { constructEvent } from './events.js';

class NoChanges extends Data.TaggedError('NoChanges')<{
  count: 0;
}> {
  static make = () => new NoChanges({ count: 0 });
}

class TeamMemberLookup extends Schema.Class<TeamMemberLookup>('TeamMemberLookup')({
  id: TeamMember.TeamMemberId,
}) {}

const getRsvpCounts = (
  rsvps: EventRsvpsRepository,
  eventId: Event.EventId,
  events: EventsRepository,
) =>
  Effect.Do.pipe(
    Effect.bind('counts', () => rsvps.countRsvpsByEventId(eventId)),
    Effect.bind('event', () =>
      events.findEventByIdWithDetails(eventId).pipe(Effect.map(Option.getOrUndefined)),
    ),
    Effect.map(({ counts, event }) => {
      let yesCount = 0;
      let noCount = 0;
      let maybeCount = 0;
      for (const c of counts) {
        if (c.response === 'yes') yesCount = c.count;
        else if (c.response === 'no') noCount = c.count;
        else if (c.response === 'maybe') maybeCount = c.count;
      }
      const canRsvp = event !== undefined && event.status === 'active';
      return new EventRpcModels.RsvpCountsResult({ yesCount, noCount, maybeCount, canRsvp });
    }),
  );

export const EventsRpcLive = Effect.Do.pipe(
  Effect.bind('syncEvents', () => EventSyncEventsRepository),
  Effect.bind('events', () => EventsRepository),
  Effect.bind('rsvps', () => EventRsvpsRepository),
  Effect.bind('sql', () => SqlClient.SqlClient),
  Effect.let('lookupTeamMember', ({ sql }) =>
    SqlSchema.findOne({
      Request: Schema.Struct({
        discord_user_id: Schema.String,
        team_id: Schema.String,
      }),
      Result: TeamMemberLookup,
      execute: (input) => sql`
        SELECT tm.id FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE u.discord_id = ${input.discord_user_id} AND tm.team_id = ${input.team_id}
      `,
    }),
  ),
  Effect.let(
    'Event/GetUnprocessedEvents',
    ({ syncEvents }) =>
      ({ limit }: { readonly limit: number }) =>
        syncEvents.findUnprocessed(limit).pipe(
          Effect.map(Array.map(flow(constructEvent))),
          Effect.tap(
            flow(
              Array.isEmptyReadonlyArray,
              Effect.if({
                onTrue: NoChanges.make,
                onFalse: () => Effect.void,
              }),
            ),
          ),
          Effect.tap((events) =>
            Effect.logInfo(`Collected ${events.length} event sync events from database.`),
          ),
          Effect.flatMap(Effect.allSuccesses),
          Effect.tap((events) =>
            Effect.logInfo(`Successfully mapped ${events.length} event sync events from database.`),
          ),
          Effect.catchTag('NoChanges', () => Effect.succeed(Array.empty())),
          Effect.catchAll((error) =>
            Effect.logError('GetUnprocessedEventSyncEvents failed', error).pipe(
              Effect.map(() => []),
            ),
          ),
        ),
  ),
  Effect.let(
    'Event/MarkEventProcessed',
    ({ syncEvents }) =>
      ({ id }: { readonly id: string }) =>
        syncEvents.markProcessed(id).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Event/MarkEventFailed',
    ({ syncEvents }) =>
      ({ id, error }: { readonly id: string; readonly error: string }) =>
        syncEvents.markFailed(id, error).pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Event/SaveDiscordMessageId',
    ({ events }) =>
      ({
        event_id,
        discord_channel_id,
        discord_message_id,
      }: {
        readonly event_id: Event.EventId;
        readonly discord_channel_id: string;
        readonly discord_message_id: string;
      }) =>
        events
          .saveDiscordMessageId(event_id, discord_channel_id, discord_message_id)
          .pipe(Effect.catchAll(() => Effect.void)),
  ),
  Effect.let(
    'Event/GetDiscordMessageId',
    ({ events }) =>
      ({ event_id }: { readonly event_id: Event.EventId }) =>
        events.getDiscordMessageId(event_id).pipe(
          Effect.map(
            Option.flatMap((row) =>
              Option.all({
                discord_channel_id: row.discord_channel_id,
                discord_message_id: row.discord_message_id,
              }).pipe(Option.map((ids) => new EventRpcModels.EventDiscordMessage(ids))),
            ),
          ),
          Effect.catchAll(() => Effect.succeed(Option.none())),
        ),
  ),
  Effect.let(
    'Event/SubmitRsvp',
    ({ rsvps, events, lookupTeamMember }) =>
      ({
        event_id,
        team_id,
        discord_user_id,
        response,
        message,
      }: {
        readonly event_id: Event.EventId;
        readonly team_id: Team.TeamId;
        readonly discord_user_id: Discord.Snowflake;
        readonly response: EventRsvp.RsvpResponse;
        readonly message: string | null;
      }) =>
        Effect.Do.pipe(
          Effect.bind('event', () =>
            events.findEventByIdWithDetails(event_id).pipe(
              Effect.mapError(() => new EventRpcModels.RsvpEventNotFound()),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(new EventRpcModels.RsvpEventNotFound()),
                  onSome: Effect.succeed,
                }),
              ),
            ),
          ),
          Effect.tap(({ event }) =>
            event.status === 'cancelled'
              ? Effect.fail(new EventRpcModels.RsvpDeadlinePassed())
              : Effect.void,
          ),
          Effect.bind('member', () =>
            lookupTeamMember({
              discord_user_id,
              team_id,
            }).pipe(
              Effect.mapError(() => new EventRpcModels.RsvpMemberNotFound()),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(new EventRpcModels.RsvpMemberNotFound()),
                  onSome: Effect.succeed,
                }),
              ),
            ),
          ),
          Effect.tap(({ member }) =>
            rsvps
              .upsertRsvp(event_id, member.id, response, message)
              .pipe(Effect.mapError(() => new EventRpcModels.RsvpEventNotFound())),
          ),
          Effect.flatMap(() =>
            getRsvpCounts(rsvps, event_id, events).pipe(
              Effect.mapError(() => new EventRpcModels.RsvpEventNotFound()),
            ),
          ),
        ),
  ),
  Effect.let(
    'Event/GetRsvpCounts',
    ({ rsvps, events }) =>
      ({ event_id }: { readonly event_id: Event.EventId }) =>
        getRsvpCounts(rsvps, event_id, events).pipe(
          Effect.catchAll(() =>
            Effect.succeed(
              new EventRpcModels.RsvpCountsResult({
                yesCount: 0,
                noCount: 0,
                maybeCount: 0,
                canRsvp: false,
              }),
            ),
          ),
        ),
  ),
  Effect.let(
    'Event/GetEventEmbedInfo',
    ({ events }) =>
      ({ event_id }: { readonly event_id: Event.EventId }) =>
        events.findEventByIdWithDetails(event_id).pipe(
          Effect.map(
            Option.map(
              (row) =>
                new EventRpcModels.EventEmbedInfo({
                  title: row.title,
                  description: row.description,
                  start_at: row.start_at,
                  end_at: row.end_at,
                  location: row.location,
                  event_type: row.event_type,
                }),
            ),
          ),
          Effect.catchAll(() => Effect.succeed(Option.none())),
        ),
  ),
  Effect.let(
    'Event/GetRsvpAttendees',
    ({ rsvps }) =>
      ({
        event_id,
        offset,
        limit,
      }: {
        readonly event_id: Event.EventId;
        readonly offset: number;
        readonly limit: number;
      }) =>
        Effect.Do.pipe(
          Effect.bind('attendees', () => rsvps.findRsvpAttendeesPage(event_id, offset, limit)),
          Effect.bind('total', () => rsvps.countRsvpTotal(event_id)),
          Effect.map(
            ({ attendees, total }) =>
              new EventRpcModels.RsvpAttendeesResult({
                attendees: attendees.map(
                  (row) =>
                    new EventRpcModels.RsvpAttendeeEntry({
                      discord_id: row.discord_id,
                      name: row.member_name,
                      response: row.response,
                      message: row.message,
                    }),
                ),
                total,
              }),
          ),
          Effect.catchAll(() =>
            Effect.succeed(new EventRpcModels.RsvpAttendeesResult({ attendees: [], total: 0 })),
          ),
        ),
  ),
  Bind.remove('syncEvents'),
  Bind.remove('events'),
  Bind.remove('rsvps'),
  Bind.remove('sql'),
  Bind.remove('lookupTeamMember'),
  (handlers) => EventRpcGroup.EventRpcGroup.toLayer(handlers),
);
