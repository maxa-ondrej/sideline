import { SqlClient, SqlSchema } from '@effect/sql';
import {
  type Discord,
  type Event,
  EventRpcGroup,
  EventRpcModels,
  type EventRsvp,
  Team,
  TeamMember,
  type TrainingType,
  User,
} from '@sideline/domain';
import { Bind, LogicError, Options, Schemas } from '@sideline/effect-lib';
import { Array, Data, DateTime, Effect, flow, Metric, Option, pipe, Schema } from 'effect';
import { rsvpSubmissionsTotal } from '~/metrics.js';
import { ChannelEventDividersRepository } from '~/repositories/ChannelEventDividersRepository.js';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamSettingsRepository } from '~/repositories/TeamSettingsRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';
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

const parseDateTime = (input: string): Option.Option<DateTime.Utc> => {
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(input.trim());
  if (!match) return Option.none();
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const hour = Number.parseInt(hourStr, 10);
  const minute = Number.parseInt(minuteStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59)
    return Option.none();
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  if (Number.isNaN(date.getTime())) return Option.none();
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  )
    return Option.none();
  return Option.some(DateTime.unsafeFromDate(date));
};

const createEvent = (
  sql: SqlClient.SqlClient,
  events: EventsRepository,
  syncEvents: EventSyncEventsRepository,
  members: TeamMembersRepository,
  trainingTypes: TrainingTypesRepository,
  input: {
    readonly guild_id: Discord.Snowflake;
    readonly discord_user_id: Discord.Snowflake;
    readonly event_type: Event.EventType;
    readonly title: string;
    readonly start_at: string;
    readonly end_at: Option.Option<string>;
    readonly location: Option.Option<string>;
    readonly description: Option.Option<string>;
    readonly training_type_id: Option.Option<TrainingType.TrainingTypeId>;
  },
) =>
  Effect.Do.pipe(
    Effect.bind('teamId', () =>
      SqlSchema.findOne({
        Request: Schema.String,
        Result: TeamLookupResult,
        execute: (guildId) => sql`SELECT id FROM teams WHERE guild_id = ${guildId}`,
      })(input.guild_id).pipe(
        Effect.catchTag(
          'SqlError',
          'ParseError',
          LogicError.withMessage(
            (e) => `Failed looking up team for guild ${input.guild_id}: ${e.message}`,
          ),
        ),
        Effect.flatMap(Options.toEffect(() => new EventRpcModels.CreateEventNotMember())),
        Effect.map((result) => result.id),
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
        Effect.catchTag(
          'SqlError',
          'ParseError',
          LogicError.withMessage(
            (e) => `Failed looking up user ${input.discord_user_id} in team: ${e.message}`,
          ),
        ),
        Effect.flatMap(Options.toEffect(() => new EventRpcModels.CreateEventNotMember())),
      ),
    ),
    Effect.bind('membership', ({ teamId, userLookup }) =>
      members
        .findMembershipByIds(teamId, userLookup.id)
        .pipe(Effect.flatMap(Options.toEffect(() => new EventRpcModels.CreateEventNotMember()))),
    ),
    Effect.tap(({ membership }) =>
      membership.permissions.includes('event:create')
        ? Effect.void
        : Effect.fail(new EventRpcModels.CreateEventForbidden()),
    ),
    Effect.bind('parsedStartAt', () => parseDateTime(input.start_at)),
    Effect.catchTag('NoSuchElementException', () => new EventRpcModels.CreateEventInvalidDate()),
    Effect.bind('parsedEndAt', () =>
      input.end_at.pipe(
        Option.map(parseDateTime),
        Option.map(Option.map(Effect.succeed)),
        Option.map(Option.getOrElse(() => Effect.fail(new EventRpcModels.CreateEventForbidden()))),
        Options.extractEffect,
      ),
    ),
    Effect.bind('validatedTrainingTypeId', ({ teamId }) =>
      input.event_type !== 'training'
        ? Effect.succeed(Option.none<TrainingType.TrainingTypeId>())
        : Option.match(input.training_type_id, {
            onNone: () => Effect.succeed(Option.none<TrainingType.TrainingTypeId>()),
            onSome: (ttId) =>
              trainingTypes.findTrainingTypeById(ttId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new EventRpcModels.CreateEventForbidden()),
                    onSome: (tt) =>
                      tt.team_id === teamId
                        ? Effect.succeed(Option.some(ttId))
                        : Effect.fail(new EventRpcModels.CreateEventForbidden()),
                  }),
                ),
              ),
          }),
    ),
    Effect.bind(
      'event',
      ({ teamId, userLookup, parsedStartAt, parsedEndAt, validatedTrainingTypeId }) =>
        events
          .insertEvent({
            teamId,
            trainingTypeId: validatedTrainingTypeId,
            eventType: input.event_type,
            title: input.title,
            description: input.description,
            startAt: parsedStartAt,
            endAt: parsedEndAt,
            location: input.location,
            createdBy: userLookup.team_member_id,
          })
          .pipe(
            Effect.catchTag(
              'NoSuchElementException',
              LogicError.withMessage(
                () => `Failed inserting event "${input.title}" — no row returned`,
              ),
            ),
          ),
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
  );

const rpcHandlers = Effect.Do.pipe(
  Effect.bind('events', () => EventsRepository),
  Effect.bind('rsvps', () => EventRsvpsRepository),
  Effect.bind('deps', () =>
    Effect.all({
      syncEvents: EventSyncEventsRepository,
      members: TeamMembersRepository,
      groups: GroupsRepository,
      sql: SqlClient.SqlClient,
      trainingTypesRepo: TrainingTypesRepository,
      teamsRepo: TeamsRepository,
      teamSettings: TeamSettingsRepository,
      channelDividers: ChannelEventDividersRepository,
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
    ({ rsvps, events, deps: { sql, groups, teamSettings } }) =>
      ({
        event_id,
        team_id,
        discord_user_id,
        response,
        message,
        clearMessage,
      }: {
        readonly event_id: Event.EventId;
        readonly team_id: Team.TeamId;
        readonly discord_user_id: Discord.Snowflake;
        readonly response: EventRsvp.RsvpResponse;
        readonly message: Option.Option<string>;
        readonly clearMessage: boolean;
      }) =>
        Effect.Do.pipe(
          Effect.tap(() =>
            Effect.logInfo('Submitting Rsvp Info', {
              event_id,
              team_id,
              discord_user_id,
              response,
              message,
            }),
          ),
          Effect.bind('event', () =>
            events.findEventByIdWithDetails(event_id).pipe(
              Effect.tap((event) => Effect.logInfo('Found event by id', event)),
              Effect.flatMap(Options.toEffect(() => new EventRpcModels.RsvpEventNotFound())),
            ),
          ),
          Effect.tap(({ event }) =>
            event.status !== 'active'
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
              Effect.flatMap(Options.toEffect(() => new EventRpcModels.RsvpMemberNotFound())),
            ),
          ),
          Effect.tap(({ event, member }) =>
            Option.match(event.member_group_id, {
              onNone: () => Effect.void,
              onSome: (groupId) =>
                groups
                  .getDescendantMemberIds(groupId)
                  .pipe(
                    Effect.flatMap((memberIds) =>
                      Array.contains(memberIds, member.id)
                        ? Effect.void
                        : Effect.fail(new EventRpcModels.RsvpNotGroupMember()),
                    ),
                  ),
            }),
          ),
          Effect.bind('priorRsvp', ({ member }) =>
            rsvps.findRsvpByEventAndMember(event_id, member.id),
          ),
          Effect.bind('savedRsvp', ({ member }) =>
            rsvps.upsertRsvp(event_id, member.id, response, message, clearMessage).pipe(
              Effect.catchTag(
                'NoSuchElementException',
                LogicError.withMessage(
                  () => `Failed upserting RSVP for event ${event_id} — no row returned`,
                ),
              ),
              Effect.tap(() =>
                Metric.update(pipe(rsvpSubmissionsTotal, Metric.tagged('response', response)), 1),
              ),
            ),
          ),
          Effect.bind('counts', () => getRsvpCounts(rsvps, event_id, events)),
          Effect.let(
            'isLateRsvp',
            ({ event, priorRsvp }) =>
              Option.isSome(event.reminder_sent_at) &&
              (Option.isNone(priorRsvp) ||
                Option.exists(priorRsvp, (r) => r.response !== response)),
          ),
          Effect.bind('lateRsvpChannelId', ({ isLateRsvp }) =>
            isLateRsvp
              ? teamSettings.findLateRsvpChannelId(team_id)
              : Effect.succeed(Option.none<Discord.Snowflake>()),
          ),
          Effect.map(
            ({ counts, isLateRsvp, lateRsvpChannelId, savedRsvp }) =>
              new EventRpcModels.SubmitRsvpResult({
                yesCount: counts.yesCount,
                noCount: counts.noCount,
                maybeCount: counts.maybeCount,
                canRsvp: counts.canRsvp,
                isLateRsvp,
                lateRsvpChannelId,
                message: savedRsvp.message,
              }),
          ),
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
                      nickname: row.nickname,
                      username: row.username,
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
          Effect.bind('yesAttendees', () => rsvps.findYesAttendeesForEmbed(event_id, 50)),
          Effect.map(({ counts, nonResponders, yesAttendees }) => {
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
                    nickname: nr.nickname,
                    username: nr.username,
                  }),
              ),
              yesAttendees: Array.map(
                yesAttendees,
                (a) =>
                  new EventRpcModels.NonResponderRpcEntry({
                    discord_id: a.discord_id,
                    name: a.member_name,
                    nickname: a.nickname,
                    username: a.username,
                  }),
              ),
            });
          }),
        ),
  ),
  Effect.let(
    'Event/GetUpcomingGuildEvents',
    ({ events, deps: { sql } }) =>
      ({
        guild_id,
        offset,
        limit,
      }: {
        readonly guild_id: Discord.Snowflake;
        readonly offset: number;
        readonly limit: number;
      }) =>
        Effect.Do.pipe(
          Effect.bind('teamId', () =>
            SqlSchema.findOne({
              Request: Schema.String,
              Result: TeamLookupResult,
              execute: (guildId) => sql`SELECT id FROM teams WHERE guild_id = ${guildId}`,
            })(guild_id).pipe(
              Effect.mapError(() => new EventRpcModels.GuildNotFound()),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(new EventRpcModels.GuildNotFound()),
                  onSome: (r) => Effect.succeed(r.id),
                }),
              ),
            ),
          ),
          Effect.bind('rows', () => events.findUpcomingByGuildId(guild_id, offset, limit)),
          Effect.bind('total', () => events.countUpcomingByGuildId(guild_id)),
          Effect.map(
            ({ teamId, rows, total }) =>
              new EventRpcModels.GuildEventListResult({
                events: Array.map(
                  rows,
                  (row) =>
                    new EventRpcModels.GuildEventListEntry({
                      event_id: row.event_id,
                      title: row.title,
                      start_at: row.start_at,
                      end_at: row.end_at,
                      location: row.location,
                      event_type: row.event_type,
                      yes_count: row.yes_count,
                      no_count: row.no_count,
                      maybe_count: row.maybe_count,
                    }),
                ),
                total,
                team_id: teamId,
              }),
          ),
        ),
  ),
  Effect.let(
    'Event/GetUpcomingEventsForUser',
    ({ deps: { sql } }) =>
      ({
        guild_id,
        discord_user_id,
        offset,
        limit,
      }: {
        readonly guild_id: Discord.Snowflake;
        readonly discord_user_id: Discord.Snowflake;
        readonly offset: number;
        readonly limit: number;
      }) =>
        Effect.Do.pipe(
          Effect.bind('teamId', () =>
            SqlSchema.findOne({
              Request: Schema.String,
              Result: TeamLookupResult,
              execute: (guildId) => sql`SELECT id FROM teams WHERE guild_id = ${guildId}`,
            })(guild_id).pipe(
              Effect.tapError((err) => Effect.logWarning('Guild lookup failed', err)),
              Effect.mapError(() => new EventRpcModels.GuildNotFound()),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(new EventRpcModels.GuildNotFound()),
                  onSome: (r) => Effect.succeed(r.id),
                }),
              ),
            ),
          ),
          Effect.bind('member', ({ teamId }) =>
            SqlSchema.findOne({
              Request: Schema.Struct({ discord_user_id: Schema.String, team_id: Schema.String }),
              Result: Schema.Struct({
                id: TeamMember.TeamMemberId,
              }),
              execute: (input) => sql`
                SELECT tm.id FROM team_members tm
                JOIN users u ON u.id = tm.user_id
                WHERE u.discord_id = ${input.discord_user_id} AND tm.team_id = ${input.team_id}
                  AND tm.active = true
              `,
            })({ discord_user_id, team_id: teamId }).pipe(
              Effect.tapError((err) => Effect.logWarning('Member lookup failed', err)),
              Effect.mapError(() => new EventRpcModels.RsvpMemberNotFound()),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.fail(new EventRpcModels.RsvpMemberNotFound()),
                  onSome: (r) => Effect.succeed(r),
                }),
              ),
            ),
          ),
          Effect.bind('rows', ({ teamId, member }) =>
            SqlSchema.findAll({
              Request: Schema.Struct({
                team_id: Schema.String,
                team_member_id: Schema.String,
                offset: Schema.Number,
                limit: Schema.Number,
              }),
              Result: Schema.Struct({
                event_id: Schema.String,
                team_id: Schema.String,
                title: Schema.String,
                description: Schema.OptionFromNullOr(Schema.String),
                start_at: Schemas.DateTimeFromDate,
                end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
                location: Schema.OptionFromNullOr(Schema.String),
                event_type: Schema.String,
                yes_count: Schema.Number,
                no_count: Schema.Number,
                maybe_count: Schema.Number,
                my_response: Schema.OptionFromNullOr(Schema.Literal('yes', 'no', 'maybe')),
                my_message: Schema.OptionFromNullOr(Schema.String),
              }),
              execute: (input) => sql`
                SELECT
                  e.id AS event_id,
                  e.team_id,
                  e.title,
                  e.description,
                  e.start_at,
                  e.end_at,
                  e.location,
                  e.event_type,
                  COALESCE(SUM(CASE WHEN er.response = 'yes' THEN 1 ELSE 0 END), 0)::int AS yes_count,
                  COALESCE(SUM(CASE WHEN er.response = 'no' THEN 1 ELSE 0 END), 0)::int AS no_count,
                  COALESCE(SUM(CASE WHEN er.response = 'maybe' THEN 1 ELSE 0 END), 0)::int AS maybe_count,
                  my_rsvp.response AS my_response,
                  my_rsvp.message AS my_message
                FROM events e
                LEFT JOIN event_rsvps er ON er.event_id = e.id
                LEFT JOIN event_rsvps my_rsvp ON my_rsvp.event_id = e.id
                  AND my_rsvp.team_member_id = ${input.team_member_id}
                WHERE e.team_id = ${input.team_id}
                  AND e.status = 'active'
                  AND e.start_at >= now()
                  AND (
                    e.member_group_id IS NULL
                    OR EXISTS (
                      WITH RECURSIVE descendant_groups AS (
                        SELECT id FROM groups WHERE id = e.member_group_id AND team_id = ${input.team_id}
                        UNION ALL
                        SELECT g.id FROM groups g JOIN descendant_groups dg ON g.parent_id = dg.id WHERE g.team_id = ${input.team_id}
                      )
                      SELECT 1 FROM group_members gm
                      WHERE gm.group_id IN (SELECT id FROM descendant_groups)
                        AND gm.team_member_id = ${input.team_member_id}
                    )
                  )
                GROUP BY e.id, my_rsvp.response, my_rsvp.message
                ORDER BY e.start_at ASC
                LIMIT ${input.limit} OFFSET ${input.offset}
              `,
            })({
              team_id: teamId,
              team_member_id: member.id,
              offset,
              limit,
            }).pipe(
              Effect.catchTag(
                'SqlError',
                'ParseError',
                LogicError.withMessage(
                  (e) => `Failed querying upcoming events for user: ${e.message}`,
                ),
              ),
            ),
          ),
          Effect.bind('total', ({ teamId, member }) =>
            SqlSchema.findOne({
              Request: Schema.Struct({
                team_id: Schema.String,
                team_member_id: Schema.String,
              }),
              Result: Schema.Struct({ count: Schema.Number }),
              execute: (input) => sql`
                SELECT COUNT(DISTINCT e.id)::int AS count
                FROM events e
                WHERE e.team_id = ${input.team_id}
                  AND e.status = 'active'
                  AND e.start_at >= now()
                  AND (
                    e.member_group_id IS NULL
                    OR EXISTS (
                      WITH RECURSIVE descendant_groups AS (
                        SELECT id FROM groups WHERE id = e.member_group_id AND team_id = ${input.team_id}
                        UNION ALL
                        SELECT g.id FROM groups g JOIN descendant_groups dg ON g.parent_id = dg.id WHERE g.team_id = ${input.team_id}
                      )
                      SELECT 1 FROM group_members gm
                      WHERE gm.group_id IN (SELECT id FROM descendant_groups)
                        AND gm.team_member_id = ${input.team_member_id}
                    )
                  )
              `,
            })({
              team_id: teamId,
              team_member_id: member.id,
            }).pipe(
              Effect.catchTag(
                'SqlError',
                'ParseError',
                LogicError.withMessage(
                  (e) => `Failed counting upcoming events for user: ${e.message}`,
                ),
              ),
              Effect.map(Option.map((r) => r.count)),
              Effect.map(Option.getOrElse(() => 0)),
            ),
          ),
          Effect.map(
            ({ rows, total, teamId }) =>
              new EventRpcModels.UpcomingEventsForUserResult({
                events: Array.map(
                  rows,
                  (row) =>
                    new EventRpcModels.UpcomingEventForUserEntry({
                      event_id: row.event_id,
                      team_id: row.team_id,
                      title: row.title,
                      description: row.description,
                      start_at: row.start_at,
                      end_at: row.end_at,
                      location: row.location,
                      event_type: row.event_type,
                      yes_count: row.yes_count,
                      no_count: row.no_count,
                      maybe_count: row.maybe_count,
                      my_response: row.my_response,
                      my_message: row.my_message,
                    }),
                ),
                total,
                team_id: teamId,
              }),
          ),
        ),
  ),
);

export const EventsRpcLive = rpcHandlers.pipe(
  Effect.let(
    'Event/GetTrainingTypesByGuild',
    ({ deps: { trainingTypesRepo, teamsRepo } }) =>
      ({ guild_id }: { readonly guild_id: Discord.Snowflake }) =>
        teamsRepo.findByGuildId(guild_id).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeed(Array.empty<EventRpcModels.TrainingTypeChoice>()),
              onSome: (team) =>
                trainingTypesRepo.findTrainingTypesByTeamId(team.id).pipe(
                  Effect.map(
                    Array.map(
                      (tt) =>
                        new EventRpcModels.TrainingTypeChoice({
                          id: tt.id,
                          name: tt.name,
                        }),
                    ),
                  ),
                ),
            }),
          ),
          Effect.catchAllDefect((defect) =>
            Effect.logError(defect).pipe(
              Effect.as(Array.empty<EventRpcModels.TrainingTypeChoice>()),
            ),
          ),
        ),
  ),
  Effect.let(
    'Event/GetYesAttendeesForEmbed',
    ({ rsvps }) =>
      ({ event_id, limit }: { readonly event_id: Event.EventId; readonly limit: number }) =>
        rsvps.findYesAttendeesForEmbed(event_id, limit).pipe(
          Effect.map(
            Array.map(
              (row) =>
                new EventRpcModels.RsvpAttendeeEntry({
                  discord_id: row.discord_id,
                  name: row.member_name,
                  nickname: row.nickname,
                  username: row.username,
                  response: row.response,
                  message: row.message,
                }),
            ),
          ),
        ),
  ),
  Effect.let(
    'Event/CreateEvent',
    ({ deps: { sql, members, syncEvents, trainingTypesRepo }, events }) =>
      (input: {
        readonly guild_id: Discord.Snowflake;
        readonly discord_user_id: Discord.Snowflake;
        readonly event_type: Event.EventType;
        readonly title: string;
        readonly start_at: string;
        readonly end_at: Option.Option<string>;
        readonly location: Option.Option<string>;
        readonly description: Option.Option<string>;
        readonly training_type_id: Option.Option<TrainingType.TrainingTypeId>;
      }) =>
        createEvent(sql, events, syncEvents, members, trainingTypesRepo, input),
  ),
  Effect.let(
    'Event/GetChannelDivider',
    ({ deps: { channelDividers } }) =>
      ({ discord_channel_id }: { readonly discord_channel_id: Discord.Snowflake }) =>
        channelDividers.findByChannelId(discord_channel_id),
  ),
  Effect.let(
    'Event/SaveChannelDivider',
    ({ deps: { channelDividers } }) =>
      ({
        discord_channel_id,
        discord_message_id,
      }: {
        readonly discord_channel_id: Discord.Snowflake;
        readonly discord_message_id: Discord.Snowflake;
      }) =>
        channelDividers.upsert(discord_channel_id, discord_message_id),
  ),
  Effect.let(
    'Event/DeleteChannelDivider',
    ({ deps: { channelDividers } }) =>
      ({ discord_channel_id }: { readonly discord_channel_id: Discord.Snowflake }) =>
        channelDividers.deleteByChannelId(discord_channel_id),
  ),
  Bind.remove('events'),
  Bind.remove('rsvps'),
  Bind.remove('deps'),
  (handlers) => EventRpcGroup.EventRpcGroup.toLayer(handlers),
);
