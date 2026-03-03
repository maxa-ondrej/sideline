import { SqlClient, SqlSchema } from '@effect/sql';
import { EventSeries, Team, TeamMember, TrainingType } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class EventSeriesRow extends Schema.Class<EventSeriesRow>('EventSeriesRow')({
  id: EventSeries.EventSeriesId,
  team_id: Team.TeamId,
  training_type_id: Schema.NullOr(TrainingType.TrainingTypeId),
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  frequency: EventSeries.RecurrenceFrequency,
  day_of_week: EventSeries.DayOfWeek,
  start_date: Schema.String,
  end_date: Schema.NullOr(Schema.String),
  status: EventSeries.EventSeriesStatus,
}) {}

class EventSeriesWithDetails extends Schema.Class<EventSeriesWithDetails>('EventSeriesWithDetails')(
  {
    id: EventSeries.EventSeriesId,
    team_id: Team.TeamId,
    training_type_id: Schema.NullOr(TrainingType.TrainingTypeId),
    title: Schema.String,
    description: Schema.NullOr(Schema.String),
    start_time: Schema.String,
    end_time: Schema.NullOr(Schema.String),
    location: Schema.NullOr(Schema.String),
    frequency: EventSeries.RecurrenceFrequency,
    day_of_week: EventSeries.DayOfWeek,
    start_date: Schema.String,
    end_date: Schema.NullOr(Schema.String),
    status: EventSeries.EventSeriesStatus,
    training_type_name: Schema.NullOr(Schema.String),
    last_generated_date: Schema.NullOr(Schema.String),
  },
) {}

class EventSeriesForGeneration extends Schema.Class<EventSeriesForGeneration>(
  'EventSeriesForGeneration',
)({
  id: EventSeries.EventSeriesId,
  team_id: Team.TeamId,
  training_type_id: Schema.NullOr(TrainingType.TrainingTypeId),
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  frequency: EventSeries.RecurrenceFrequency,
  day_of_week: EventSeries.DayOfWeek,
  start_date: Schema.String,
  end_date: Schema.NullOr(Schema.String),
  last_generated_date: Schema.NullOr(Schema.String),
  created_by: TeamMember.TeamMemberId,
  event_horizon_days: Schema.Number,
}) {}

class EventSeriesInsertInput extends Schema.Class<EventSeriesInsertInput>('EventSeriesInsertInput')(
  {
    team_id: Schema.String,
    training_type_id: Schema.NullOr(Schema.String),
    title: Schema.String,
    description: Schema.NullOr(Schema.String),
    start_time: Schema.String,
    end_time: Schema.NullOr(Schema.String),
    location: Schema.NullOr(Schema.String),
    frequency: Schema.String,
    day_of_week: Schema.Number,
    start_date: Schema.String,
    end_date: Schema.NullOr(Schema.String),
    created_by: Schema.String,
  },
) {}

class EventSeriesUpdateInput extends Schema.Class<EventSeriesUpdateInput>('EventSeriesUpdateInput')(
  {
    id: EventSeries.EventSeriesId,
    title: Schema.String,
    training_type_id: Schema.NullOr(Schema.String),
    description: Schema.NullOr(Schema.String),
    start_time: Schema.String,
    end_time: Schema.NullOr(Schema.String),
    location: Schema.NullOr(Schema.String),
    end_date: Schema.NullOr(Schema.String),
  },
) {}

export class EventSeriesRepository extends Effect.Service<EventSeriesRepository>()(
  'api/EventSeriesRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('insertSeries', ({ sql }) =>
        SqlSchema.single({
          Request: EventSeriesInsertInput,
          Result: EventSeriesRow,
          execute: (input) => sql`
            INSERT INTO event_series (team_id, training_type_id, title, description,
                                      start_time, end_time, location, frequency,
                                      day_of_week, start_date, end_date, created_by)
            VALUES (${input.team_id}, ${input.training_type_id}, ${input.title},
                    ${input.description}, ${input.start_time}, ${input.end_time},
                    ${input.location}, ${input.frequency}, ${input.day_of_week},
                    ${input.start_date}, ${input.end_date}, ${input.created_by})
            RETURNING id, team_id, training_type_id, title, description,
                      start_time::text, end_time::text, location, frequency,
                      day_of_week, start_date::text, end_date::text, status
          `,
        }),
      ),
      Effect.let('findByTeamId', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: EventSeriesWithDetails,
          execute: (teamId) => sql`
            SELECT es.id, es.team_id, es.training_type_id, es.title, es.description,
                   es.start_time::text, es.end_time::text, es.location, es.frequency,
                   es.day_of_week, es.start_date::text, es.end_date::text, es.status,
                   tt.name AS training_type_name, es.last_generated_date::text
            FROM event_series es
            LEFT JOIN training_types tt ON tt.id = es.training_type_id
            WHERE es.team_id = ${teamId}
            ORDER BY es.start_date DESC
          `,
        }),
      ),
      Effect.let('findById', ({ sql }) =>
        SqlSchema.findOne({
          Request: EventSeries.EventSeriesId,
          Result: EventSeriesWithDetails,
          execute: (id) => sql`
            SELECT es.id, es.team_id, es.training_type_id, es.title, es.description,
                   es.start_time::text, es.end_time::text, es.location, es.frequency,
                   es.day_of_week, es.start_date::text, es.end_date::text, es.status,
                   tt.name AS training_type_name, es.last_generated_date::text
            FROM event_series es
            LEFT JOIN training_types tt ON tt.id = es.training_type_id
            WHERE es.id = ${id}
          `,
        }),
      ),
      Effect.let('findActiveForGeneration', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.Void,
          Result: EventSeriesForGeneration,
          execute: () => sql`
            SELECT es.id, es.team_id, es.training_type_id, es.title, es.description,
                   es.start_time::text, es.end_time::text, es.location, es.frequency,
                   es.day_of_week, es.start_date::text, es.end_date::text,
                   es.last_generated_date::text, es.created_by,
                   COALESCE(ts.event_horizon_days, 30) AS event_horizon_days
            FROM event_series es
            LEFT JOIN team_settings ts ON ts.team_id = es.team_id
            WHERE es.status = 'active'
              AND (es.end_date IS NULL OR es.end_date > CURRENT_DATE)
          `,
        }),
      ),
      Effect.let('setLastGeneratedDate', ({ sql }) =>
        SqlSchema.void({
          Request: Schema.Struct({
            id: EventSeries.EventSeriesId,
            last_generated_date: Schema.String,
          }),
          execute: (input) =>
            sql`UPDATE event_series SET last_generated_date = ${input.last_generated_date}::date, updated_at = now() WHERE id = ${input.id}`,
        }),
      ),
      Effect.let('updateSeries', ({ sql }) =>
        SqlSchema.single({
          Request: EventSeriesUpdateInput,
          Result: EventSeriesRow,
          execute: (input) => sql`
            UPDATE event_series SET
              title = ${input.title},
              training_type_id = ${input.training_type_id},
              description = ${input.description},
              start_time = ${input.start_time},
              end_time = ${input.end_time},
              location = ${input.location},
              end_date = ${input.end_date},
              updated_at = now()
            WHERE id = ${input.id}
            RETURNING id, team_id, training_type_id, title, description,
                      start_time::text, end_time::text, location, frequency,
                      day_of_week, start_date::text, end_date::text, status
          `,
        }),
      ),
      Effect.let('cancelSeries', ({ sql }) =>
        SqlSchema.void({
          Request: EventSeries.EventSeriesId,
          execute: (id) =>
            sql`UPDATE event_series SET status = 'cancelled', updated_at = now() WHERE id = ${id}`,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  insertEventSeries(input: {
    teamId: Team.TeamId;
    trainingTypeId: string | null;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string | null;
    location: string | null;
    frequency: string;
    dayOfWeek: number;
    startDate: string;
    endDate: string | null;
    createdBy: string;
  }) {
    return this.insertSeries({
      team_id: input.teamId,
      training_type_id: input.trainingTypeId,
      title: input.title,
      description: input.description,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      frequency: input.frequency,
      day_of_week: input.dayOfWeek,
      start_date: input.startDate,
      end_date: input.endDate,
      created_by: input.createdBy,
    });
  }

  findSeriesByTeamId(teamId: Team.TeamId) {
    return this.findByTeamId(teamId);
  }

  findSeriesById(seriesId: EventSeries.EventSeriesId) {
    return this.findById(seriesId);
  }

  updateEventSeries(input: {
    id: EventSeries.EventSeriesId;
    title: string;
    trainingTypeId: string | null;
    description: string | null;
    startTime: string;
    endTime: string | null;
    location: string | null;
    endDate: string | null;
  }) {
    return this.updateSeries({
      id: input.id,
      title: input.title,
      training_type_id: input.trainingTypeId,
      description: input.description,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      end_date: input.endDate,
    });
  }

  cancelEventSeries(seriesId: EventSeries.EventSeriesId) {
    return this.cancelSeries(seriesId);
  }

  getActiveForGeneration() {
    return this.findActiveForGeneration(undefined as undefined);
  }

  updateLastGeneratedDate(seriesId: EventSeries.EventSeriesId, date: string) {
    return this.setLastGeneratedDate({ id: seriesId, last_generated_date: date });
  }
}
