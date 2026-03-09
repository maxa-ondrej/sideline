import { SqlClient, SqlSchema } from '@effect/sql';
import {
  type Discord,
  type Event,
  EventRpcGroup,
  EventRpcModels,
  type EventRsvp,
  Team,
  TeamMember,
  User,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Array, Data, Effect, flow, Option, Schema } from 'effect';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { resolveChannel } from '~/services/EventChannelResolver.js';
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

class TeamLookupResult extends Schema.Class<TeamLookupResult>('TeamLookupResult')({
  id: Team.TeamId,
}) {}

class UserLookupResult extends Schema.Class<UserLookupResult>('UserLookupResult')({
  id: User.UserId,
  team_member_id: TeamMember.TeamMemberId,
}) {}

const parseDateTime = (input: string): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const hour = Number.parseInt(hourStr, 10);
  const minute = Number.parseInt(minuteStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  )
    return null;
  return date.toISOString();
};

const createEvent = (
  sql: SqlClient.SqlClient,
  events: EventsRepository,
  syncEvents: EventSyncEventsRepository,
  members: TeamMembersRepository,
  input: {
    readonly guild_id: Discord.Snowflake;
    readonly discord_user_id: Discord.Snowflake;
    readonly event_type: Event.EventType;
    readonly title: string;
    readonly start_at: string;
    readonly end_at: Option.Option<string>;
    readonly location: Option.Option<string>;
    readonly description: Option.Option<string>;
  },
) =>
  Effect.Do.pipe(
    Effect.bind('teamId', () =>
      SqlSchema.findOne({
        Request: Schema.String,
        Result: TeamLookupResult,
        execute: (guildId) => sql`SELECT id FROM teams WHERE guild_id = ${guildId}`,
      })(input.guild_id).pipe(
        Effect.mapError(() => new EventRpcModels.CreateEventNotMember()),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new EventRpcModels.CreateEventNotMember()),
            onSome: (r) => Effect.succeed(r.id),
          }),
        ),
      ),
    ),
    Effect.bind('userLookup', ({ teamId }) =>
      SqlSchema.findOne({
        Request: Schema.Struct({
          discord_user_id: Schema.String,
          team_id: Schema.String,
        }),
        Result: UserLookupResult,
        execute: (i) => sql`
          SELECT u.id, tm.id AS team_member_id FROM team_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE u.discord_id = ${i.discord_user_id} AND tm.team_id = ${i.team_id}
        `,
      })({
        discord_user_id: input.discord_user_id,
        team_id: teamId,
      }).pipe(
        Effect.mapError(() => new EventRpcModels.CreateEventNotMember()),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new EventRpcModels.CreateEventNotMember()),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.bind('membership', ({ teamId, userLookup }) =>
      members.findMembershipByIds(teamId, userLookup.id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new EventRpcModels.CreateEventNotMember()),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.tap(({ membership }) =>
      membership.permissions.includes('event:create')
        ? Effect.void
        : Effect.fail(new EventRpcModels.CreateEventForbidden()),
    ),
    Effect.bind('parsedStartAt', () => {
      const parsed = parseDateTime(input.start_at);
      return parsed
        ? Effect.succeed(parsed)
        : Effect.fail(new EventRpcModels.CreateEventInvalidDate());
    }),
    Effect.bind('parsedEndAt', () =>
      Option.match(input.end_at, {
        onNone: () => Effect.succeed(Option.none<string>()),
        onSome: (endAt) => {
          const parsed = parseDateTime(endAt);
          return parsed
            ? Effect.succeed(Option.some(parsed))
            : Effect.fail(new EventRpcModels.CreateEventInvalidDate());
        },
      }),
    ),
    Effect.bind('event', ({ teamId, userLookup, parsedStartAt, parsedEndAt }) =>
      events.insertEvent({
        teamId,
        trainingTypeId: Option.none(),
        eventType: input.event_type,
        title: input.title,
        description: input.description,
        startAt: parsedStartAt,
        endAt: parsedEndAt,
        location: input.location,
        createdBy: userLookup.team_member_id,
      }),
    ),
    Effect.bind('resolvedChannel', ({ teamId, event }) => resolveChannel(teamId, event.id)),
    Effect.tap(({ teamId, event, resolvedChannel }) =>
      syncEvents.emitEventCreated(
        teamId,
        event.id,
        event.title,
        event.description,
        event.start_at,
        event.end_at,
        event.location,
        event.event_type,
        resolvedChannel,
      ),
    ),
    Effect.map(
      ({ event }) =>
        new EventRpcModels.CreateEventResult({
          event_id: event.id,
          title: event.title,
        }),
    ),
    Effect.catchTag('NoSuchElementException', Effect.die),
  );

export const EventsRpcLive = Effect.Do.pipe(
  Effect.bind('events', () => EventsRepository),
  Effect.bind('rsvps', () => EventRsvpsRepository),
  Effect.bind('deps', () =>
    Effect.all({
      syncEvents: EventSyncEventsRepository,
      members: TeamMembersRepository,
      sql: SqlClient.SqlClient,
    }),
  ),
  Effect.let(
    'Event/GetUnprocessedEvents',
    ({ deps: { syncEvents } }) =>
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
        ),
  ),
  Effect.let(
    'Event/MarkEventProcessed',
    ({ deps: { syncEvents } }) =>
      ({ id }: { readonly id: string }) =>
        syncEvents.markProcessed(id),
  ),
  Effect.let(
    'Event/MarkEventFailed',
    ({ deps: { syncEvents } }) =>
      ({ id, error }: { readonly id: string; readonly error: string }) =>
        syncEvents.markFailed(id, error),
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
        readonly discord_channel_id: Discord.Snowflake;
        readonly discord_message_id: Discord.Snowflake;
      }) =>
        events.saveDiscordMessageId(event_id, discord_channel_id, discord_message_id),
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
        ),
  ),
  Effect.let(
    'Event/SubmitRsvp',
    ({ rsvps, events, deps: { sql } }) =>
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
        readonly message: Option.Option<string>;
      }) =>
        Effect.Do.pipe(
          Effect.bind('event', () =>
            events.findEventByIdWithDetails(event_id).pipe(
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
            })({
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
          Effect.tap(({ member }) => rsvps.upsertRsvp(event_id, member.id, response, message)),
          Effect.flatMap(() => getRsvpCounts(rsvps, event_id, events)),
          Effect.catchTag('NoSuchElementException', Effect.die),
        ),
  ),
  Effect.let(
    'Event/GetRsvpCounts',
    ({ rsvps, events }) =>
      ({ event_id }: { readonly event_id: Event.EventId }) =>
        getRsvpCounts(rsvps, event_id, events),
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
        ),
  ),
  Effect.let(
    'Event/GetChannelEvents',
    ({ events }) =>
      ({ discord_channel_id }: { readonly discord_channel_id: Discord.Snowflake }) =>
        events.findEventsByChannelId(discord_channel_id).pipe(
          Effect.map(
            Array.map(
              (row) =>
                new EventRpcModels.ChannelEventEntry({
                  event_id: row.event_id,
                  team_id: row.team_id,
                  title: row.title,
                  description: row.description,
                  start_at: row.start_at,
                  end_at: row.end_at,
                  location: row.location,
                  event_type: row.event_type,
                  status: row.status,
                  discord_message_id: row.discord_message_id,
                }),
            ),
          ),
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
                attendees: Array.map(
                  attendees,
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
        ),
  ),
  Effect.let(
    'Event/GetRsvpReminderSummary',
    ({ rsvps, events }) =>
      ({ event_id }: { readonly event_id: Event.EventId }) =>
        Effect.Do.pipe(
          Effect.bind('event', () =>
            events.findEventByIdWithDetails(event_id).pipe(Effect.map(Option.getOrUndefined)),
          ),
          Effect.bind('counts', () => rsvps.countRsvpsByEventId(event_id)),
          Effect.bind('nonResponders', ({ event }) =>
            event ? rsvps.findNonRespondersByEventId(event_id, event.team_id) : Effect.succeed([]),
          ),
          Effect.map(({ counts, nonResponders }) => {
            let yesCount = 0;
            let noCount = 0;
            let maybeCount = 0;
            for (const c of counts) {
              if (c.response === 'yes') yesCount = c.count;
              else if (c.response === 'no') noCount = c.count;
              else if (c.response === 'maybe') maybeCount = c.count;
            }
            return new EventRpcModels.RsvpReminderSummary({
              yesCount,
              noCount,
              maybeCount,
              nonResponders: Array.map(
                nonResponders,
                (nr) =>
                  new EventRpcModels.NonResponderRpcEntry({
                    discord_id: nr.discord_id,
                    name: nr.member_name,
                    username: nr.username,
                  }),
              ),
            });
          }),
        ),
  ),
  Effect.let(
    'Event/CreateEvent',
    ({ deps: { sql, members, syncEvents }, events }) =>
      (input: {
        readonly guild_id: Discord.Snowflake;
        readonly discord_user_id: Discord.Snowflake;
        readonly event_type: Event.EventType;
        readonly title: string;
        readonly start_at: string;
        readonly end_at: Option.Option<string>;
        readonly location: Option.Option<string>;
        readonly description: Option.Option<string>;
      }) =>
        createEvent(sql, events, syncEvents, members, input),
  ),
  Bind.remove('events'),
  Bind.remove('rsvps'),
  Bind.remove('deps'),
  (handlers) => EventRpcGroup.EventRpcGroup.toLayer(handlers),
);
