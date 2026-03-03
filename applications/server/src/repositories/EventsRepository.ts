import { SqlClient, SqlSchema } from '@effect/sql';
import { Event, Team, TeamMember, TrainingType } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class EventWithDetails extends Schema.Class<EventWithDetails>('EventWithDetails')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.NullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  event_date: Schema.String,
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
  training_type_name: Schema.NullOr(Schema.String),
  created_by_name: Schema.NullOr(Schema.String),
}) {}

class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.NullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  event_date: Schema.String,
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
}) {}

class EventInsertInput extends Schema.Class<EventInsertInput>('EventInsertInput')({
  team_id: Schema.String,
  training_type_id: Schema.NullOr(Schema.String),
  event_type: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  event_date: Schema.String,
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  created_by: Schema.String,
}) {}

class EventUpdateInput extends Schema.Class<EventUpdateInput>('EventUpdateInput')({
  id: Event.EventId,
  title: Schema.String,
  event_type: Schema.String,
  training_type_id: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  event_date: Schema.String,
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
}) {}

class ScopedTrainingTypeId extends Schema.Class<ScopedTrainingTypeId>('ScopedTrainingTypeId')({
  training_type_id: TrainingType.TrainingTypeId,
}) {}

export class EventsRepository extends Effect.Service<EventsRepository>()('api/EventsRepository', {
  effect: SqlClient.SqlClient.pipe(
    Effect.bindTo('sql'),
    Effect.let('findByTeamId', ({ sql }) =>
      SqlSchema.findAll({
        Request: Schema.String,
        Result: EventWithDetails,
        execute: (teamId) => sql`
            SELECT e.id, e.team_id, e.training_type_id, e.event_type, e.title,
                   e.description, e.event_date::text, e.start_time::text, e.end_time::text,
                   e.location, e.status, e.created_by,
                   tt.name AS training_type_name,
                   u.name AS created_by_name
            FROM events e
            LEFT JOIN training_types tt ON tt.id = e.training_type_id
            LEFT JOIN team_members tm ON tm.id = e.created_by
            LEFT JOIN users u ON u.id = tm.user_id
            WHERE e.team_id = ${teamId}
            ORDER BY e.event_date DESC, e.start_time DESC
          `,
      }),
    ),
    Effect.let('findByIdWithDetails', ({ sql }) =>
      SqlSchema.findOne({
        Request: Event.EventId,
        Result: EventWithDetails,
        execute: (id) => sql`
            SELECT e.id, e.team_id, e.training_type_id, e.event_type, e.title,
                   e.description, e.event_date::text, e.start_time::text, e.end_time::text,
                   e.location, e.status, e.created_by,
                   tt.name AS training_type_name,
                   u.name AS created_by_name
            FROM events e
            LEFT JOIN training_types tt ON tt.id = e.training_type_id
            LEFT JOIN team_members tm ON tm.id = e.created_by
            LEFT JOIN users u ON u.id = tm.user_id
            WHERE e.id = ${id}
          `,
      }),
    ),
    Effect.let('insert', ({ sql }) =>
      SqlSchema.single({
        Request: EventInsertInput,
        Result: EventRow,
        execute: (input) => sql`
            INSERT INTO events (team_id, training_type_id, event_type, title, description,
                                event_date, start_time, end_time, location, created_by)
            VALUES (${input.team_id}, ${input.training_type_id}, ${input.event_type},
                    ${input.title}, ${input.description}, ${input.event_date},
                    ${input.start_time}, ${input.end_time}, ${input.location}, ${input.created_by})
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      event_date::text, start_time::text, end_time::text, location, status, created_by
          `,
      }),
    ),
    Effect.let('update', ({ sql }) =>
      SqlSchema.single({
        Request: EventUpdateInput,
        Result: EventRow,
        execute: (input) => sql`
            UPDATE events SET
              title = ${input.title},
              event_type = ${input.event_type},
              training_type_id = ${input.training_type_id},
              description = ${input.description},
              event_date = ${input.event_date},
              start_time = ${input.start_time},
              end_time = ${input.end_time},
              location = ${input.location},
              updated_at = now()
            WHERE id = ${input.id}
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      event_date::text, start_time::text, end_time::text, location, status, created_by
          `,
      }),
    ),
    Effect.let('cancel', ({ sql }) =>
      SqlSchema.void({
        Request: Event.EventId,
        execute: (id) =>
          sql`UPDATE events SET status = 'cancelled', updated_at = now() WHERE id = ${id}`,
      }),
    ),
    Effect.let('findScopedTrainingTypeIds', ({ sql }) =>
      SqlSchema.findAll({
        Request: TeamMember.TeamMemberId,
        Result: ScopedTrainingTypeId,
        execute: (teamMemberId) => sql`
            SELECT DISTINCT rtt.training_type_id
            FROM member_roles mr
            JOIN role_training_types rtt ON rtt.role_id = mr.role_id
            WHERE mr.team_member_id = ${teamMemberId}
          `,
      }),
    ),
    Bind.remove('sql'),
  ),
}) {
  findEventsByTeamId(teamId: Team.TeamId) {
    return this.findByTeamId(teamId);
  }

  findEventByIdWithDetails(eventId: Event.EventId) {
    return this.findByIdWithDetails(eventId);
  }

  insertEvent(input: {
    teamId: Team.TeamId;
    trainingTypeId: string | null;
    eventType: string;
    title: string;
    description: string | null;
    eventDate: string;
    startTime: string;
    endTime: string | null;
    location: string | null;
    createdBy: TeamMember.TeamMemberId;
  }) {
    return this.insert({
      team_id: input.teamId,
      training_type_id: input.trainingTypeId,
      event_type: input.eventType,
      title: input.title,
      description: input.description,
      event_date: input.eventDate,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
      created_by: input.createdBy,
    });
  }

  updateEvent(input: {
    id: Event.EventId;
    title: string;
    eventType: string;
    trainingTypeId: string | null;
    description: string | null;
    eventDate: string;
    startTime: string;
    endTime: string | null;
    location: string | null;
  }) {
    return this.update({
      id: input.id,
      title: input.title,
      event_type: input.eventType,
      training_type_id: input.trainingTypeId,
      description: input.description,
      event_date: input.eventDate,
      start_time: input.startTime,
      end_time: input.endTime,
      location: input.location,
    });
  }

  cancelEvent(eventId: Event.EventId) {
    return this.cancel(eventId);
  }

  getScopedTrainingTypeIds(teamMemberId: TeamMember.TeamMemberId) {
    return this.findScopedTrainingTypeIds(teamMemberId);
  }
}
