import { SqlClient, SqlSchema } from '@effect/sql';
import { Event, EventSeries, Team, TeamMember, TrainingType } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class EventWithDetails extends Schema.Class<EventWithDetails>('EventWithDetails')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.NullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
  training_type_name: Schema.NullOr(Schema.String),
  created_by_name: Schema.NullOr(Schema.String),
  series_id: Schema.NullOr(EventSeries.EventSeriesId),
  series_modified: Schema.Boolean,
  discord_target_channel_id: Schema.NullOr(Schema.String),
}) {}

class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: Event.EventId,
  team_id: Team.TeamId,
  training_type_id: Schema.NullOr(TrainingType.TrainingTypeId),
  event_type: Event.EventType,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  status: Event.EventStatus,
  created_by: TeamMember.TeamMemberId,
  series_id: Schema.NullOr(EventSeries.EventSeriesId),
  series_modified: Schema.Boolean,
  discord_target_channel_id: Schema.NullOr(Schema.String),
}) {}

class EventInsertInput extends Schema.Class<EventInsertInput>('EventInsertInput')({
  team_id: Schema.String,
  training_type_id: Schema.NullOr(Schema.String),
  event_type: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  created_by: Schema.String,
  series_id: Schema.NullOr(Schema.String),
  discord_target_channel_id: Schema.NullOr(Schema.String),
}) {}

class EventUpdateInput extends Schema.Class<EventUpdateInput>('EventUpdateInput')({
  id: Event.EventId,
  title: Schema.String,
  event_type: Schema.String,
  training_type_id: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  discord_target_channel_id: Schema.NullOr(Schema.String),
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
                   e.description, e.start_at::text, e.end_at::text,
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
      }),
    ),
    Effect.let('findByIdWithDetails', ({ sql }) =>
      SqlSchema.findOne({
        Request: Event.EventId,
        Result: EventWithDetails,
        execute: (id) => sql`
            SELECT e.id, e.team_id, e.training_type_id, e.event_type, e.title,
                   e.description, e.start_at::text, e.end_at::text,
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
      }),
    ),
    Effect.let('insert', ({ sql }) =>
      SqlSchema.single({
        Request: EventInsertInput,
        Result: EventRow,
        execute: (input) => sql`
            INSERT INTO events (team_id, training_type_id, event_type, title, description,
                                start_at, end_at, location, created_by, series_id,
                                discord_target_channel_id)
            VALUES (${input.team_id}, ${input.training_type_id}, ${input.event_type},
                    ${input.title}, ${input.description}, ${input.start_at},
                    ${input.end_at}, ${input.location}, ${input.created_by},
                    ${input.series_id}, ${input.discord_target_channel_id})
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      start_at::text, end_at::text, location, status,
                      created_by, series_id, series_modified, discord_target_channel_id
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
              start_at = ${input.start_at},
              end_at = ${input.end_at},
              location = ${input.location},
              discord_target_channel_id = ${input.discord_target_channel_id},
              updated_at = now()
            WHERE id = ${input.id}
            RETURNING id, team_id, training_type_id, event_type, title, description,
                      start_at::text, end_at::text, location, status,
                      created_by, series_id, series_modified, discord_target_channel_id
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
    Effect.let('saveDiscordMessage', ({ sql }) =>
      SqlSchema.void({
        Request: Schema.Struct({
          event_id: Event.EventId,
          discord_channel_id: Schema.String,
          discord_message_id: Schema.String,
        }),
        execute: (input) =>
          sql`UPDATE events SET discord_channel_id = ${input.discord_channel_id}, discord_message_id = ${input.discord_message_id} WHERE id = ${input.event_id}`,
      }),
    ),
    Effect.let('getDiscordMessage', ({ sql }) =>
      SqlSchema.findOne({
        Request: Event.EventId,
        Result: Schema.Struct({
          discord_channel_id: Schema.NullOr(Schema.String),
          discord_message_id: Schema.NullOr(Schema.String),
        }),
        execute: (id) =>
          sql`SELECT discord_channel_id, discord_message_id FROM events WHERE id = ${id}`,
      }),
    ),
    Effect.let('markModified', ({ sql }) =>
      SqlSchema.void({
        Request: Event.EventId,
        execute: (id) =>
          sql`UPDATE events SET series_modified = true, updated_at = now() WHERE id = ${id}`,
      }),
    ),
    Effect.let('cancelFuture', ({ sql }) =>
      SqlSchema.void({
        Request: Schema.Struct({
          series_id: Schema.String,
          from_date: Schema.String,
        }),
        execute: (input) =>
          sql`UPDATE events SET status = 'cancelled', updated_at = now()
              WHERE series_id = ${input.series_id}
                AND (start_at AT TIME ZONE 'UTC')::date >= ${input.from_date}::date
                AND status = 'active'`,
      }),
    ),
    Effect.let('updateFutureUnmodified', ({ sql }) =>
      SqlSchema.void({
        Request: Schema.Struct({
          series_id: Schema.String,
          from_date: Schema.String,
          title: Schema.String,
          training_type_id: Schema.NullOr(Schema.String),
          description: Schema.NullOr(Schema.String),
          start_time: Schema.String,
          end_time: Schema.NullOr(Schema.String),
          location: Schema.NullOr(Schema.String),
        }),
        execute: (input) =>
          sql`UPDATE events SET
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
    startAt: string;
    endAt: string | null;
    location: string | null;
    createdBy: TeamMember.TeamMemberId;
    seriesId?: string | null;
    discordTargetChannelId?: string | null;
  }) {
    return this.insert({
      team_id: input.teamId,
      training_type_id: input.trainingTypeId,
      event_type: input.eventType,
      title: input.title,
      description: input.description,
      start_at: input.startAt,
      end_at: input.endAt,
      location: input.location,
      created_by: input.createdBy,
      series_id: input.seriesId ?? null,
      discord_target_channel_id: input.discordTargetChannelId ?? null,
    });
  }

  updateEvent(input: {
    id: Event.EventId;
    title: string;
    eventType: string;
    trainingTypeId: string | null;
    description: string | null;
    startAt: string;
    endAt: string | null;
    location: string | null;
    discordTargetChannelId?: string | null;
  }) {
    return this.update({
      id: input.id,
      title: input.title,
      event_type: input.eventType,
      training_type_id: input.trainingTypeId,
      description: input.description,
      start_at: input.startAt,
      end_at: input.endAt,
      location: input.location,
      discord_target_channel_id: input.discordTargetChannelId ?? null,
    });
  }

  cancelEvent(eventId: Event.EventId) {
    return this.cancel(eventId);
  }

  getScopedTrainingTypeIds(teamMemberId: TeamMember.TeamMemberId) {
    return this.findScopedTrainingTypeIds(teamMemberId);
  }

  saveDiscordMessageId(eventId: Event.EventId, channelId: string, messageId: string) {
    return this.saveDiscordMessage({
      event_id: eventId,
      discord_channel_id: channelId,
      discord_message_id: messageId,
    });
  }

  getDiscordMessageId(eventId: Event.EventId) {
    return this.getDiscordMessage(eventId);
  }

  markEventSeriesModified(eventId: Event.EventId) {
    return this.markModified(eventId);
  }

  cancelFutureInSeries(seriesId: EventSeries.EventSeriesId, fromDate: string) {
    return this.cancelFuture({ series_id: seriesId, from_date: fromDate });
  }

  updateFutureUnmodifiedInSeries(
    seriesId: EventSeries.EventSeriesId,
    fromDate: string,
    fields: {
      title: string;
      trainingTypeId: string | null;
      description: string | null;
      startTime: string;
      endTime: string | null;
      location: string | null;
    },
  ) {
    return this.updateFutureUnmodified({
      series_id: seriesId,
      from_date: fromDate,
      title: fields.title,
      training_type_id: fields.trainingTypeId,
      description: fields.description,
      start_time: fields.startTime,
      end_time: fields.endTime,
      location: fields.location,
    });
  }
}
