import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, Event, Team } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';

const EventSyncEventType = Schema.Literal(
  'event_created',
  'event_updated',
  'event_cancelled',
  'rsvp_reminder',
);
type EventSyncEventType = typeof EventSyncEventType.Type;

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: EventSyncEventType,
  event_id: Schema.String,
  event_title: Schema.String,
  event_description: Schema.OptionFromNullOr(Schema.String),
  event_start_at: Schema.String,
  event_end_at: Schema.OptionFromNullOr(Schema.String),
  event_location: Schema.OptionFromNullOr(Schema.String),
  event_event_type: Schema.String,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

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
  event_start_at: Schema.String,
  event_end_at: Schema.OptionFromNullOr(Schema.String),
  event_location: Schema.OptionFromNullOr(Schema.String),
  event_event_type: Schema.String,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class MarkProcessedInput extends Schema.Class<MarkProcessedInput>('MarkProcessedInput')({
  id: Schema.String,
}) {}

class MarkFailedInput extends Schema.Class<MarkFailedInput>('MarkFailedInput')({
  id: Schema.String,
  error: Schema.String,
}) {}

export class EventSyncEventsRepository extends Effect.Service<EventSyncEventsRepository>()(
  'api/EventSyncEventsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private insertEvent = SqlSchema.void({
    Request: InsertInput,
    execute: (input) => this.sql`
      INSERT INTO event_sync_events (team_id, guild_id, event_type, event_id, event_title, event_description, event_start_at, event_end_at, event_location, event_event_type, discord_target_channel_id)
      VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.event_id}, ${input.event_title}, ${input.event_description}, ${input.event_start_at}, ${input.event_end_at}, ${input.event_location}, ${input.event_event_type}, ${input.discord_target_channel_id})
    `,
  });

  private lookupGuildId = SqlSchema.findOne({
    Request: Schema.String,
    Result: GuildLookupResult,
    execute: (teamId) => this.sql`SELECT guild_id FROM teams WHERE id = ${teamId}`,
  });

  private findUnprocessedEvents = SqlSchema.findAll({
    Request: Schema.Number,
    Result: EventSyncEventRow,
    execute: (limit) => this.sql`
      SELECT id, team_id, guild_id, event_type, event_id, event_title, event_description, event_start_at, event_end_at, event_location, event_event_type, discord_target_channel_id
      FROM event_sync_events
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
    `,
  });

  private markEventProcessed = SqlSchema.void({
    Request: MarkProcessedInput,
    execute: (input) => this.sql`
      UPDATE event_sync_events SET processed_at = now() WHERE id = ${input.id}
    `,
  });

  private markEventFailed = SqlSchema.void({
    Request: MarkFailedInput,
    execute: (input) => this.sql`
      UPDATE event_sync_events SET processed_at = now(), error = ${input.error} WHERE id = ${input.id}
    `,
  });

  private _emitIfGuildLinked = (
    teamId: Team.TeamId,
    eventType: EventSyncEventType,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: string,
    endAt: Option.Option<string>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this.lookupGuildId(teamId).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: ({ guild_id }) =>
            this.insertEvent({
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
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  emitEventCreated = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: string,
    endAt: Option.Option<string>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this._emitIfGuildLinked(
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

  emitEventUpdated = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: string,
    endAt: Option.Option<string>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this._emitIfGuildLinked(
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

  emitEventCancelled = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: string,
    endAt: Option.Option<string>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this._emitIfGuildLinked(
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

  emitRsvpReminder = (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    title: string,
    description: Option.Option<string>,
    startAt: string,
    endAt: Option.Option<string>,
    location: Option.Option<string>,
    eventEventType: string,
    discordTargetChannelId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this._emitIfGuildLinked(
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

  findUnprocessed = (limit: number) =>
    this.findUnprocessedEvents(limit).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  markProcessed = (id: string) =>
    this.markEventProcessed({ id }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  markFailed = (id: string, error: string) =>
    this.markEventFailed({ id, error }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
}
