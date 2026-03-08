import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, EventSeries, Team, TeamMember, TrainingType } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';

class EventSeriesRow extends Schema.Class<EventSeriesRow>('EventSeriesRow')({
  id: EventSeries.EventSeriesId,
  team_id: Team.TeamId,
  training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_time: Schema.String,
  end_time: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  frequency: EventSeries.RecurrenceFrequency,
  days_of_week: EventSeries.DaysOfWeek,
  start_date: Schema.String,
  end_date: Schema.OptionFromNullOr(Schema.String),
  status: EventSeries.EventSeriesStatus,
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class EventSeriesWithDetails extends Schema.Class<EventSeriesWithDetails>('EventSeriesWithDetails')(
  {
    id: EventSeries.EventSeriesId,
    team_id: Team.TeamId,
    training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
    title: Schema.String,
    description: Schema.OptionFromNullOr(Schema.String),
    start_time: Schema.String,
    end_time: Schema.OptionFromNullOr(Schema.String),
    location: Schema.OptionFromNullOr(Schema.String),
    frequency: EventSeries.RecurrenceFrequency,
    days_of_week: EventSeries.DaysOfWeek,
    start_date: Schema.String,
    end_date: Schema.OptionFromNullOr(Schema.String),
    status: EventSeries.EventSeriesStatus,
    training_type_name: Schema.OptionFromNullOr(Schema.String),
    last_generated_date: Schema.OptionFromNullOr(Schema.String),
    discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  },
) {}

class EventSeriesForGeneration extends Schema.Class<EventSeriesForGeneration>(
  'EventSeriesForGeneration',
)({
  id: EventSeries.EventSeriesId,
  team_id: Team.TeamId,
  training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_time: Schema.String,
  end_time: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  frequency: EventSeries.RecurrenceFrequency,
  days_of_week: EventSeries.DaysOfWeek,
  start_date: Schema.String,
  end_date: Schema.OptionFromNullOr(Schema.String),
  last_generated_date: Schema.OptionFromNullOr(Schema.String),
  discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  created_by: TeamMember.TeamMemberId,
  event_horizon_days: Schema.Number,
}) {}

class EventSeriesInsertInput extends Schema.Class<EventSeriesInsertInput>('EventSeriesInsertInput')(
  {
    team_id: Schema.String,
    training_type_id: Schema.OptionFromNullOr(Schema.String),
    title: Schema.String,
    description: Schema.OptionFromNullOr(Schema.String),
    start_time: Schema.String,
    end_time: Schema.OptionFromNullOr(Schema.String),
    location: Schema.OptionFromNullOr(Schema.String),
    frequency: Schema.String,
    days_of_week: Schema.Array(Schema.Number),
    start_date: Schema.String,
    end_date: Schema.OptionFromNullOr(Schema.String),
    created_by: Schema.String,
    discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  },
) {}

class EventSeriesUpdateInput extends Schema.Class<EventSeriesUpdateInput>('EventSeriesUpdateInput')(
  {
    id: EventSeries.EventSeriesId,
    title: Schema.String,
    training_type_id: Schema.OptionFromNullOr(Schema.String),
    description: Schema.OptionFromNullOr(Schema.String),
    days_of_week: Schema.Array(Schema.Number),
    start_time: Schema.String,
    end_time: Schema.OptionFromNullOr(Schema.String),
    location: Schema.OptionFromNullOr(Schema.String),
    end_date: Schema.OptionFromNullOr(Schema.String),
    discord_target_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  },
) {}

export class EventSeriesRepository extends Effect.Service<EventSeriesRepository>()(
  'api/EventSeriesRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private insertSeries = SqlSchema.single({
    Request: EventSeriesInsertInput,
    Result: EventSeriesRow,
    execute: (input) => this.sql`
            INSERT INTO event_series (team_id, training_type_id, title, description,
                                      start_time, end_time, location, frequency,
                                      days_of_week, start_date, end_date, created_by,
                                      discord_target_channel_id)
            VALUES (${input.team_id}, ${input.training_type_id}, ${input.title},
                    ${input.description}, ${input.start_time}, ${input.end_time},
                    ${input.location}, ${input.frequency}, ${input.days_of_week},
                    ${input.start_date}, ${input.end_date}, ${input.created_by},
                    ${input.discord_target_channel_id})
            RETURNING id, team_id, training_type_id, title, description,
                      start_time::text, end_time::text, location, frequency,
                      days_of_week, start_date::text, end_date::text, status,
                      discord_target_channel_id
          `,
  });

  private findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: EventSeriesWithDetails,
    execute: (teamId) => this.sql`
            SELECT es.id, es.team_id, es.training_type_id, es.title, es.description,
                   es.start_time::text, es.end_time::text, es.location, es.frequency,
                   es.days_of_week, es.start_date::text, es.end_date::text, es.status,
                   tt.name AS training_type_name, es.last_generated_date::text,
                   es.discord_target_channel_id
            FROM event_series es
            LEFT JOIN training_types tt ON tt.id = es.training_type_id
            WHERE es.team_id = ${teamId}
            ORDER BY es.start_date DESC
          `,
  });

  private findById = SqlSchema.findOne({
    Request: EventSeries.EventSeriesId,
    Result: EventSeriesWithDetails,
    execute: (id) => this.sql`
            SELECT es.id, es.team_id, es.training_type_id, es.title, es.description,
                   es.start_time::text, es.end_time::text, es.location, es.frequency,
                   es.days_of_week, es.start_date::text, es.end_date::text, es.status,
                   tt.name AS training_type_name, es.last_generated_date::text,
                   es.discord_target_channel_id
            FROM event_series es
            LEFT JOIN training_types tt ON tt.id = es.training_type_id
            WHERE es.id = ${id}
          `,
  });

  private findActiveForGeneration = SqlSchema.findAll({
    Request: Schema.Void,
    Result: EventSeriesForGeneration,
    execute: () => this.sql`
            SELECT es.id, es.team_id, es.training_type_id, es.title, es.description,
                   es.start_time::text, es.end_time::text, es.location, es.frequency,
                   es.days_of_week, es.start_date::text, es.end_date::text,
                   es.last_generated_date::text, es.discord_target_channel_id,
                   es.created_by,
                   COALESCE(ts.event_horizon_days, 30) AS event_horizon_days
            FROM event_series es
            LEFT JOIN team_settings ts ON ts.team_id = es.team_id
            WHERE es.status = 'active'
              AND (es.end_date IS NULL OR es.end_date > CURRENT_DATE)
          `,
  });

  private setLastGeneratedDate = SqlSchema.void({
    Request: Schema.Struct({
      id: EventSeries.EventSeriesId,
      last_generated_date: Schema.String,
    }),
    execute: (input) =>
      this
        .sql`UPDATE event_series SET last_generated_date = ${input.last_generated_date}::date, updated_at = now() WHERE id = ${input.id}`,
  });

  private updateSeries = SqlSchema.single({
    Request: EventSeriesUpdateInput,
    Result: EventSeriesRow,
    execute: (input) => this.sql`
            UPDATE event_series SET
              title = ${input.title},
              training_type_id = ${input.training_type_id},
              description = ${input.description},
              days_of_week = ${input.days_of_week},
              start_time = ${input.start_time},
              end_time = ${input.end_time},
              location = ${input.location},
              end_date = ${input.end_date},
              discord_target_channel_id = ${input.discord_target_channel_id},
              updated_at = now()
            WHERE id = ${input.id}
            RETURNING id, team_id, training_type_id, title, description,
                      start_time::text, end_time::text, location, frequency,
                      days_of_week, start_date::text, end_date::text, status,
                      discord_target_channel_id
          `,
  });

  private cancelSeries = SqlSchema.void({
    Request: EventSeries.EventSeriesId,
    execute: (id) =>
      this.sql`UPDATE event_series SET status = 'cancelled', updated_at = now() WHERE id = ${id}`,
  });

  insertEventSeries = ({
    teamId,
    trainingTypeId,
    title,
    description,
    startTime,
    endTime,
    location,
    frequency,
    daysOfWeek,
    startDate,
    endDate,
    createdBy,
    discordTargetChannelId = Option.none(),
  }: {
    teamId: Team.TeamId;
    trainingTypeId: Option.Option<string>;
    title: string;
    description: Option.Option<string>;
    startTime: string;
    endTime: Option.Option<string>;
    location: Option.Option<string>;
    frequency: string;
    daysOfWeek: ReadonlyArray<number>;
    startDate: string;
    endDate: Option.Option<string>;
    createdBy: string;
    discordTargetChannelId?: Option.Option<Discord.Snowflake>;
  }) => {
    return this.insertSeries({
      team_id: teamId,
      training_type_id: trainingTypeId,
      title,
      description,
      start_time: startTime,
      end_time: endTime,
      location,
      frequency,
      days_of_week: Array.from(daysOfWeek),
      start_date: startDate,
      end_date: endDate,
      created_by: createdBy,
      discord_target_channel_id: discordTargetChannelId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  findSeriesByTeamId = (teamId: Team.TeamId) => {
    return this.findByTeamId(teamId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  findSeriesById = (seriesId: EventSeries.EventSeriesId) => {
    return this.findById(seriesId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  updateEventSeries = ({
    id,
    title,
    trainingTypeId,
    description,
    daysOfWeek,
    startTime,
    endTime,
    location,
    endDate,
    discordTargetChannelId = Option.none(),
  }: {
    id: EventSeries.EventSeriesId;
    title: string;
    trainingTypeId: Option.Option<string>;
    description: Option.Option<string>;
    daysOfWeek: ReadonlyArray<number>;
    startTime: string;
    endTime: Option.Option<string>;
    location: Option.Option<string>;
    endDate: Option.Option<string>;
    discordTargetChannelId?: Option.Option<Discord.Snowflake>;
  }) => {
    return this.updateSeries({
      id,
      title,
      training_type_id: trainingTypeId,
      description,
      days_of_week: Array.from(daysOfWeek),
      start_time: startTime,
      end_time: endTime,
      location,
      end_date: endDate,
      discord_target_channel_id: discordTargetChannelId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  cancelEventSeries = (seriesId: EventSeries.EventSeriesId) => {
    return this.cancelSeries(seriesId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
  };

  getActiveForGeneration = () => {
    return this.findActiveForGeneration(undefined as undefined).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };

  updateLastGeneratedDate = (seriesId: EventSeries.EventSeriesId, date: string) => {
    return this.setLastGeneratedDate({ id: seriesId, last_generated_date: date }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
  };
}
