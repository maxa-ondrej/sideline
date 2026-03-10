import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, Event, EventSeries, Team, TeamMember, TrainingType } from '@sideline/domain';
import { Schemas } from '@sideline/effect-lib';
import { type DateTime, Effect, Option, Schema } from 'effect';

class EventWithDetails extends Schema.Class<EventWithDetails>('EventWithDetails')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
  training_type_name: Schema.OptionFromNullOr(Schema.String),
  created_by_name: Schema.OptionFromNullOr(Schema.String),
  series_id: Schema.OptionFromNullOr(EventSeries.EventSeriesId),
  series_modified: Schema.Boolean,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
  series_id: Schema.OptionFromNullOr(EventSeries.EventSeriesId),
  series_modified: Schema.Boolean,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class EventInsertInput extends Schema.Class<EventInsertInput>('EventInsertInput')({
  team_id: Schema.String,
  training_type_id: Schema.OptionFromNullOr(Schema.String),
  event_type: Schema.String,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  created_by: Schema.String,
  series_id: Schema.OptionFromNullOr(Schema.String),
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class EventUpdateInput extends Schema.Class<EventUpdateInput>('EventUpdateInput')({
  id: Event.EventId,
  title: Schema.String,
  event_type: Schema.String,
  training_type_id: Schema.OptionFromNullOr(Schema.String),
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromDate,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
  location: Schema.OptionFromNullOr(Schema.String),
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class ScopedTrainingTypeId extends Schema.Class<ScopedTrainingTypeId>('ScopedTrainingTypeId')({
  training_type_id: TrainingType.TrainingTypeId,
}) {}

export class EventsRepository extends Effect.Service<EventsRepository>()('api/EventsRepository', {
  effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
}) {
  private findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: EventWithDetails,
    execute: (teamId) => this.sql`
            SELECT e.id, e.team_id, e.training_type_id, e.event_type, e.title,
                   e.description, e.start_at, e.end_at,
                   e.location, e.status, e.created_by,
                   tt.name AS training_type_name,
                   u.name AS created_by_name,
                   e.series_id, e.series_modified,
                   e.discord_target_channel_id
            FROM events e
            LEFT JOIN training_types tt ON tt.id = e.training_type_id
            LEFT JOIN team_members tm ON tm.id = e.created_by
            LEFT JOIN users u ON u.id = tm.user_id
            WHERE e.team_id = ${teamId}
            ORDER BY e.start_at ASC
          `,
  });

  private findByIdWithDetails = SqlSchema.findOne({
    Request: Event.EventId,
    Result: EventWithDetails,
    execute: (id) => this.sql`
            SELECT e.id, e.team_id, e.training_type_id, e.event_type, e.title,
                   e.description, e.start_at, e.end_at,
                   e.location, e.status, e.created_by,
                   tt.name AS training_type_name,
                   u.name AS created_by_name,
                   e.series_id, e.series_modified,
                   e.discord_target_channel_id
            FROM events e
            LEFT JOIN training_types tt ON tt.id = e.training_type_id
            LEFT JOIN team_members tm ON tm.id = e.created_by
            LEFT JOIN users u ON u.id = tm.user_id
            WHERE e.id = ${id}
          `,
  });

  private insert = SqlSchema.single({
    Request: EventInsertInput,
    Result: EventRow,
    execute: (input) => this.sql`
            INSERT INTO events (team_id, training_type_id, event_type, title, description,
                                start_at, end_at, location, created_by, series_id,
                                discord_target_channel_id)
            VALUES (${input.team_id}, ${input.training_type_id}, ${input.event_type},
                    ${input.title}, ${input.description}, ${input.start_at},
                    ${input.end_at}, ${input.location}, ${input.created_by},
                    ${input.series_id}, ${input.discord_target_channel_id})
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      start_at, end_at, location, status,
                      created_by, series_id, series_modified, discord_target_channel_id
          `,
  });

  private update = SqlSchema.single({
    Request: EventUpdateInput,
    Result: EventRow,
    execute: (input) => this.sql`
            UPDATE events SET
              title = ${input.title},
              event_type = ${input.event_type},
              training_type_id = ${input.training_type_id},
              description = ${input.description},
              start_at = ${input.start_at},
              end_at = ${input.end_at},
              location = ${input.location},
              discord_target_channel_id = ${input.discord_target_channel_id},
              updated_at = now()
            WHERE id = ${input.id}
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      start_at, end_at, location, status,
                      created_by, series_id, series_modified, discord_target_channel_id
          `,
  });

  private cancel = SqlSchema.void({
    Request: Event.EventId,
    execute: (id) =>
      this.sql`UPDATE events SET status = 'cancelled', updated_at = now() WHERE id = ${id}`,
  });

  private findScopedTrainingTypeIds = SqlSchema.findAll({
    Request: TeamMember.TeamMemberId,
    Result: ScopedTrainingTypeId,
    execute: (teamMemberId) => this.sql`
            SELECT DISTINCT rtt.training_type_id
            FROM member_roles mr
            JOIN role_training_types rtt ON rtt.role_id = mr.role_id
            WHERE mr.team_member_id = ${teamMemberId}
          `,
  });

  private saveDiscordMessage = SqlSchema.void({
    Request: Schema.Struct({
      event_id: Event.EventId,
      discord_channel_id: Discord.Snowflake,
      discord_message_id: Discord.Snowflake,
    }),
    execute: (input) =>
      this
        .sql`UPDATE events SET discord_channel_id = ${input.discord_channel_id}, discord_message_id = ${input.discord_message_id} WHERE id = ${input.event_id}`,
  });

  private getDiscordMessage = SqlSchema.findOne({
    Request: Event.EventId,
    Result: Schema.Struct({
      discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
      discord_message_id: Schema.OptionFromNullOr(Discord.Snowflake),
    }),
    execute: (id) =>
      this.sql`SELECT discord_channel_id, discord_message_id FROM events WHERE id = ${id}`,
  });

  private findByChannelId = SqlSchema.findAll({
    Request: Discord.Snowflake,
    Result: Schema.Struct({
      event_id: Schema.String,
      team_id: Schema.String,
      title: Schema.String,
      description: Schema.OptionFromNullOr(Schema.String),
      start_at: Schemas.DateTimeFromDate,
      end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
      location: Schema.OptionFromNullOr(Schema.String),
      event_type: Schema.String,
      status: Schema.String,
      discord_message_id: Discord.Snowflake,
    }),
    execute: (channelId) => this.sql`
            SELECT id AS event_id, team_id, title, description,
                   start_at, end_at, location, event_type,
                   status, discord_message_id
            FROM events
            WHERE discord_channel_id = ${channelId}
              AND discord_message_id IS NOT NULL
            ORDER BY start_at ASC
          `,
  });

  private markReminder = SqlSchema.void({
    Request: Event.EventId,
    execute: (id) => this.sql`UPDATE events SET reminder_sent_at = now() WHERE id = ${id}`,
  });

  private markModified = SqlSchema.void({
    Request: Event.EventId,
    execute: (id) =>
      this.sql`UPDATE events SET series_modified = true, updated_at = now() WHERE id = ${id}`,
  });

  private cancelFuture = SqlSchema.void({
    Request: Schema.Struct({
      series_id: Schema.String,
      from_date: Schema.DateFromSelf,
    }),
    execute: (input) =>
      this.sql`UPDATE events SET status = 'cancelled', updated_at = now()
              WHERE series_id = ${input.series_id}
                AND (start_at AT TIME ZONE 'UTC')::date >= ${input.from_date}::date
                AND status = 'active'`,
  });

  private updateFutureUnmodified = SqlSchema.void({
    Request: Schema.Struct({
      series_id: Schema.String,
      from_date: Schema.DateFromSelf,
      title: Schema.String,
      training_type_id: Schema.OptionFromNullOr(Schema.String),
      description: Schema.OptionFromNullOr(Schema.String),
      start_time: Schema.String,
      end_time: Schema.OptionFromNullOr(Schema.String),
      location: Schema.OptionFromNullOr(Schema.String),
    }),
    execute: (input) =>
      this.sql`UPDATE events SET
                title = ${input.title},
                training_type_id = ${input.training_type_id},
                description = ${input.description},
                start_at = ((start_at AT TIME ZONE 'UTC')::date + ${input.start_time}::time) AT TIME ZONE 'UTC',
                end_at = CASE WHEN ${input.end_time} IS NOT NULL THEN ((start_at AT TIME ZONE 'UTC')::date + ${input.end_time}::time) AT TIME ZONE 'UTC' ELSE NULL END,
                location = ${input.location},
                updated_at = now()
              WHERE series_id = ${input.series_id}
                AND (start_at AT TIME ZONE 'UTC')::date >= ${input.from_date}::date
                AND series_modified = false
                AND status = 'active'`,
  });

  findEventsByTeamId = (teamId: Team.TeamId) => {
    return this.findByTeamId(teamId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  findEventByIdWithDetails = (eventId: Event.EventId) => {
    return this.findByIdWithDetails(eventId).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };

  insertEvent = ({
    teamId,
    trainingTypeId,
    eventType,
    title,
    description,
    startAt,
    endAt,
    location,
    createdBy,
    seriesId = Option.none(),
    discordTargetChannelId = Option.none(),
  }: {
    teamId: Team.TeamId;
    trainingTypeId: Option.Option<string>;
    eventType: string;
    title: string;
    description: Option.Option<string>;
    startAt: DateTime.Utc;
    endAt: Option.Option<DateTime.Utc>;
    location: Option.Option<string>;
    createdBy: TeamMember.TeamMemberId;
    seriesId?: Option.Option<string>;
    discordTargetChannelId?: Option.Option<Discord.Snowflake>;
  }) => {
    return this.insert({
      team_id: teamId,
      training_type_id: trainingTypeId,
      event_type: eventType,
      title,
      description,
      start_at: startAt,
      end_at: endAt,
      location,
      created_by: createdBy,
      series_id: seriesId,
      discord_target_channel_id: discordTargetChannelId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  updateEvent = ({
    id,
    title,
    eventType,
    trainingTypeId,
    description,
    startAt,
    endAt,
    location,
    discordTargetChannelId = Option.none(),
  }: {
    id: Event.EventId;
    title: string;
    eventType: string;
    trainingTypeId: Option.Option<string>;
    description: Option.Option<string>;
    startAt: DateTime.Utc;
    endAt: Option.Option<DateTime.Utc>;
    location: Option.Option<string>;
    discordTargetChannelId?: Option.Option<Discord.Snowflake>;
  }) => {
    return this.update({
      id,
      title,
      event_type: eventType,
      training_type_id: trainingTypeId,
      description,
      start_at: startAt,
      end_at: endAt,
      location,
      discord_target_channel_id: discordTargetChannelId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  cancelEvent = (eventId: Event.EventId) => {
    return this.cancel(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  getScopedTrainingTypeIds = (teamMemberId: TeamMember.TeamMemberId) => {
    return this.findScopedTrainingTypeIds(teamMemberId).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };

  saveDiscordMessageId = (
    eventId: Event.EventId,
    channelId: Discord.Snowflake,
    messageId: Discord.Snowflake,
  ) => {
    return this.saveDiscordMessage({
      event_id: eventId,
      discord_channel_id: channelId,
      discord_message_id: messageId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  getDiscordMessageId = (eventId: Event.EventId) => {
    return this.getDiscordMessage(eventId).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };

  findEventsByChannelId = (channelId: Discord.Snowflake) => {
    return this.findByChannelId(channelId).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };

  markReminderSent = (eventId: Event.EventId) => {
    return this.markReminder(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  markEventSeriesModified = (eventId: Event.EventId) => {
    return this.markModified(eventId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  cancelFutureInSeries = (seriesId: EventSeries.EventSeriesId, fromDate: Date) => {
    return this.cancelFuture({ series_id: seriesId, from_date: fromDate }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };

  updateFutureUnmodifiedInSeries = (
    seriesId: EventSeries.EventSeriesId,
    fromDate: Date,
    fields: {
      title: string;
      trainingTypeId: Option.Option<string>;
      description: Option.Option<string>;
      startTime: string;
      endTime: Option.Option<string>;
      location: Option.Option<string>;
    },
  ) => {
    return this.updateFutureUnmodified({
      series_id: seriesId,
      from_date: fromDate,
      title: fields.title,
      training_type_id: fields.trainingTypeId,
      description: fields.description,
      start_time: fields.startTime,
      end_time: fields.endTime,
      location: fields.location,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };
}
