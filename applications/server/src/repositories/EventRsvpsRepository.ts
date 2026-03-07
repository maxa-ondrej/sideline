import { SqlClient, SqlSchema } from '@effect/sql';
import { Event, EventRsvp, TeamMember } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';

class RsvpWithMemberName extends Schema.Class<RsvpWithMemberName>('RsvpWithMemberName')({
  id: EventRsvp.EventRsvpId,
  event_id: Event.EventId,
  team_member_id: TeamMember.TeamMemberId,
  response: EventRsvp.RsvpResponse,
  message: Schema.NullOr(Schema.String),
  member_name: Schema.NullOr(Schema.String),
  username: Schema.NullOr(Schema.String),
}) {}

class RsvpRow extends Schema.Class<RsvpRow>('RsvpRow')({
  id: EventRsvp.EventRsvpId,
  event_id: Event.EventId,
  team_member_id: TeamMember.TeamMemberId,
  response: EventRsvp.RsvpResponse,
  message: Schema.NullOr(Schema.String),
}) {}

class UpsertInput extends Schema.Class<UpsertInput>('UpsertInput')({
  event_id: Schema.String,
  team_member_id: Schema.String,
  response: Schema.String,
  message: Schema.NullOr(Schema.String),
}) {}

class RsvpWithDiscordInfo extends Schema.Class<RsvpWithDiscordInfo>('RsvpWithDiscordInfo')({
  discord_id: Schema.NullOr(Schema.String),
  member_name: Schema.NullOr(Schema.String),
  username: Schema.NullOr(Schema.String),
  response: EventRsvp.RsvpResponse,
  message: Schema.NullOr(Schema.String),
}) {}

class NonResponderRow extends Schema.Class<NonResponderRow>('NonResponderRow')({
  team_member_id: TeamMember.TeamMemberId,
  member_name: Schema.NullOr(Schema.String),
  username: Schema.NullOr(Schema.String),
  discord_id: Schema.NullOr(Schema.String),
}) {}

class TotalCount extends Schema.Class<TotalCount>('TotalCount')({
  count: Schema.NumberFromString,
}) {}

class ResponseCount extends Schema.Class<ResponseCount>('ResponseCount')({
  response: EventRsvp.RsvpResponse,
  count: Schema.NumberFromString,
}) {}

export class EventRsvpsRepository extends Effect.Service<EventRsvpsRepository>()(
  'api/EventRsvpsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByEventId = SqlSchema.findAll({
    Request: Event.EventId,
    Result: RsvpWithMemberName,
    execute: (eventId) => this.sql`
      SELECT r.id, r.event_id, r.team_member_id, r.response, r.message,
             u.name AS member_name, u.username
      FROM event_rsvps r
      JOIN team_members tm ON tm.id = r.team_member_id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE r.event_id = ${eventId}
      ORDER BY r.created_at ASC
    `,
  });

  private findByEventAndMember = SqlSchema.findOne({
    Request: Schema.Struct({
      event_id: Schema.String,
      team_member_id: Schema.String,
    }),
    Result: RsvpRow,
    execute: (input) => this.sql`
      SELECT id, event_id, team_member_id, response, message
      FROM event_rsvps
      WHERE event_id = ${input.event_id}
        AND team_member_id = ${input.team_member_id}
    `,
  });

  private upsert = SqlSchema.single({
    Request: UpsertInput,
    Result: RsvpRow,
    execute: (input) => this.sql`
      INSERT INTO event_rsvps (event_id, team_member_id, response, message)
      VALUES (${input.event_id}, ${input.team_member_id}, ${input.response}, ${input.message})
      ON CONFLICT (event_id, team_member_id)
      DO UPDATE SET response = ${input.response}, message = ${input.message}, updated_at = now()
      RETURNING id, event_id, team_member_id, response, message
    `,
  });

  private countByEventId = SqlSchema.findAll({
    Request: Event.EventId,
    Result: ResponseCount,
    execute: (eventId) => this.sql`
      SELECT response, COUNT(*)::text AS count
      FROM event_rsvps
      WHERE event_id = ${eventId}
      GROUP BY response
    `,
  });

  private findAttendeesPage = SqlSchema.findAll({
    Request: Schema.Struct({
      event_id: Schema.String,
      limit: Schema.Number,
      offset: Schema.Number,
    }),
    Result: RsvpWithDiscordInfo,
    execute: (input) => this.sql`
      SELECT u.discord_id, u.name AS member_name, u.username, r.response, r.message
      FROM event_rsvps r
      JOIN team_members tm ON tm.id = r.team_member_id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE r.event_id = ${input.event_id}
      ORDER BY r.response ASC, r.created_at ASC
      LIMIT ${input.limit} OFFSET ${input.offset}
    `,
  });

  private countTotalByEventId = SqlSchema.findOne({
    Request: Event.EventId,
    Result: TotalCount,
    execute: (eventId) => this.sql`
      SELECT COUNT(*)::text AS count
      FROM event_rsvps
      WHERE event_id = ${eventId}
    `,
  });

  private findNonResponders = SqlSchema.findAll({
    Request: Schema.Struct({
      event_id: Schema.String,
      team_id: Schema.String,
    }),
    Result: NonResponderRow,
    execute: (input) => this.sql`
      SELECT tm.id AS team_member_id, u.name AS member_name, u.username, u.discord_id
      FROM team_members tm
      LEFT JOIN users u ON u.id = tm.user_id
      LEFT JOIN event_rsvps er ON er.team_member_id = tm.id AND er.event_id = ${input.event_id}
      WHERE tm.team_id = ${input.team_id}
        AND tm.active = true
        AND er.id IS NULL
      ORDER BY u.name ASC
    `,
  });

  findRsvpsByEventId = (eventId: Event.EventId) => {
    return this.findByEventId(eventId).pipe(Effect.orDie);
  };

  findRsvpByEventAndMember = (eventId: Event.EventId, teamMemberId: TeamMember.TeamMemberId) => {
    return this.findByEventAndMember({ event_id: eventId, team_member_id: teamMemberId }).pipe(
      Effect.orDie,
    );
  };

  upsertRsvp = (
    eventId: Event.EventId,
    teamMemberId: TeamMember.TeamMemberId,
    response: EventRsvp.RsvpResponse,
    message: string | null,
  ) => {
    return this.upsert({
      event_id: eventId,
      team_member_id: teamMemberId,
      response,
      message,
    }).pipe(Effect.orDie);
  };

  countRsvpsByEventId = (eventId: Event.EventId) => {
    return this.countByEventId(eventId).pipe(Effect.orDie);
  };

  findRsvpAttendeesPage = (eventId: Event.EventId, offset: number, limit: number) => {
    return this.findAttendeesPage({ event_id: eventId, limit, offset }).pipe(Effect.orDie);
  };

  findNonRespondersByEventId = (eventId: Event.EventId, teamId: string) => {
    return this.findNonResponders({ event_id: eventId, team_id: teamId }).pipe(Effect.orDie);
  };

  countRsvpTotal = (eventId: Event.EventId) => {
    return this.countTotalByEventId(eventId).pipe(
      Effect.map(Option.match({ onNone: () => 0, onSome: (r) => r.count })),
      Effect.orDie,
    );
  };
}
