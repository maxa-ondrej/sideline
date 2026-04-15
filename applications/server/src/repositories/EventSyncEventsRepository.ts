import { Discord, Event, Team } from '@sideline/domain';
import { Schemas } from '@sideline/effect-lib';
import { type DateTime, Effect, Layer, Option, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

const EventSyncEventType = Schema.Literals([
  'event_created',
  'event_updated',
  'event_cancelled',
  'rsvp_reminder',
  'event_started',
]);
type EventSyncEventType = typeof EventSyncEventType.Type;

const InsertInput = Schema.Struct({
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: EventSyncEventType,
  event_id: Schema.String,
  event_title: Schema.String,
  event_description: Schema.OptionFromNullOr(Schema.String),
  event_start_at: Schemas.DateTimeFromIsoString,
  event_end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  event_location: Schema.OptionFromNullOr(Schema.String),
  event_event_type: Schema.String,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
});

class GuildLookupResult extends Schema.Class<GuildLookupResult>('GuildLookupResult')({
  guild_id: Discord.Snowflake,
}) {}

export class EventSyncEventRow extends Schema.Class<EventSyncEventRow>('EventSyncEventRow')({
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: EventSyncEventType,
  event_id: Event.EventId,
  event_title: Schema.String,
  event_description: Schema.OptionFromNullOr(Schema.String),
  event_start_at: Schemas.DateTimeFromIsoString,
  event_end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  event_location: Schema.OptionFromNullOr(Schema.String),
  event_event_type: Schema.String,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

const MarkProcessedInput = Schema.Struct({
  id: Schema.String,
});

const MarkFailedInput = Schema.Struct({
  id: Schema.String,
  error: Schema.String,
});

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const insertEvent = SqlSchema.void({
    Request: InsertInput,
    execute: (input) => sql`
      INSERT INTO event_sync_events (team_id, guild_id, event_type, event_id, event_title, event_description, event_start_at, event_end_at, event_location, event_event_type, discord_target_channel_id)
      VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.event_id}, ${input.event_title}, ${input.event_description}, ${input.event_start_at}, ${input.event_end_at}, ${input.event_location}, ${input.event_event_type}, ${input.discord_target_channel_id})
    `,
  });

  const lookupGuildId = SqlSchema.findOneOption({
    Request: Schema.String,
    Result: GuildLookupResult,
    execute: (teamId) => sql`SELECT guild_id FROM teams WHERE id = ${teamId}`,
  });

  const findUnprocessedEvents = SqlSchema.findAll({
    Request: Schema.Number,
    Result: EventSyncEventRow,
    execute: (limit) => sql`
      SELECT id, team_id, guild_id, event_type, event_id, event_title, event_description, event_start_at, event_end_at, event_location, event_event_type, discord_target_channel_id
      FROM event_sync_events
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
    `,
  });

  const markEventProcessed = SqlSchema.void({
    Request: MarkProcessedInput,
    execute: (input) => sql`
      UPDATE event_sync_events SET processed_at = now() WHERE id = ${input.id}
    `,
  });

  const markEventFailed = SqlSchema.void({
    Request: MarkFailedInput,
    execute: (input) => sql`
      UPDATE event_sync_events SET processed_at = now(), error = ${input.error} WHERE id = ${input.id}
    `,
  });

  const _emitIfGuildLinked = (
    teamId: Team.TeamId,
    eventType: EventSyncEventType,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: DateTime.Utc,
    endAt: Option.Option<DateTime.Utc>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    lookupGuildId(teamId).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: ({ guild_id }) =>
            insertEvent({
              team_id: teamId,
              guild_id,
              event_type: eventType,
              event_id: eventId,
              event_title: title,
              event_description: description,
              event_start_at: startAt,
              event_end_at: endAt,
              event_location: location,
              event_event_type: eventEventType,
              discord_target_channel_id: discordTargetChannelId,
            }),
        }),
      ),
      catchSqlErrors,
    );

  const emitEventCreated = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: DateTime.Utc,
    endAt: Option.Option<DateTime.Utc>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    _emitIfGuildLinked(
      teamId,
      'event_created',
      eventId,
      title,
      description,
      startAt,
      endAt,
      location,
      eventEventType,
      discordTargetChannelId,
    );

  const emitEventUpdated = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: DateTime.Utc,
    endAt: Option.Option<DateTime.Utc>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    _emitIfGuildLinked(
      teamId,
      'event_updated',
      eventId,
      title,
      description,
      startAt,
      endAt,
      location,
      eventEventType,
      discordTargetChannelId,
    );

  const emitEventCancelled = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: DateTime.Utc,
    endAt: Option.Option<DateTime.Utc>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    _emitIfGuildLinked(
      teamId,
      'event_cancelled',
      eventId,
      title,
      description,
      startAt,
      endAt,
      location,
      eventEventType,
      discordTargetChannelId,
    );

  const emitRsvpReminder = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: DateTime.Utc,
    endAt: Option.Option<DateTime.Utc>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    _emitIfGuildLinked(
      teamId,
      'rsvp_reminder',
      eventId,
      title,
      description,
      startAt,
      endAt,
      location,
      eventEventType,
      discordTargetChannelId,
    );

  const emitEventStarted = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: DateTime.Utc,
    endAt: Option.Option<DateTime.Utc>,
    location: Option.Option<string>,
    eventEventType: string,
  ) =>
    _emitIfGuildLinked(
      teamId,
      'event_started',
      eventId,
      title,
      description,
      startAt,
      endAt,
      location,
      eventEventType,
    );

  const findUnprocessed = (limit: number) => findUnprocessedEvents(limit).pipe(catchSqlErrors);

  const markProcessed = (id: string) => markEventProcessed({ id }).pipe(catchSqlErrors);

  const markFailed = (id: string, error: string) =>
    markEventFailed({ id, error }).pipe(catchSqlErrors);

  return {
    emitEventCreated,
    emitEventUpdated,
    emitEventCancelled,
    emitRsvpReminder,
    emitEventStarted,
    findUnprocessed,
    markProcessed,
    markFailed,
  };
});

export class EventSyncEventsRepository extends ServiceMap.Service<
  EventSyncEventsRepository,
  Effect.Success<typeof make>
>()('api/EventSyncEventsRepository') {
  static readonly Default = Layer.effect(EventSyncEventsRepository, make);
}
