import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, Event, EventRsvp, TeamMember } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class RsvpWithMemberName extends Schema.Class<RsvpWithMemberName>('RsvpWithMemberName')({
  id: EventRsvp.EventRsvpId,
  event_id: Event.EventId,
  team_member_id: TeamMember.TeamMemberId,
  response: EventRsvp.RsvpResponse,
  message: Schema.OptionFromNullOr(Schema.String),
  member_name: Schema.OptionFromNullOr(Schema.String),
  username: Schema.OptionFromNullOr(Schema.String),
}) {}

class RsvpRow extends Schema.Class<RsvpRow>('RsvpRow')({
  id: EventRsvp.EventRsvpId,
  event_id: Event.EventId,
  team_member_id: TeamMember.TeamMemberId,
  response: EventRsvp.RsvpResponse,
  message: Schema.OptionFromNullOr(Schema.String),
}) {}

class UpsertInput extends Schema.Class<UpsertInput>('UpsertInput')({
  event_id: Schema.String,
  team_member_id: Schema.String,
  response: Schema.String,
  message: Schema.OptionFromNullOr(Schema.String),
}) {}

class UpsertClearInput extends Schema.Class<UpsertClearInput>('UpsertClearInput')({
  event_id: Schema.String,
  team_member_id: Schema.String,
  response: Schema.String,
}) {}

class RsvpWithDiscordInfo extends Schema.Class<RsvpWithDiscordInfo>('RsvpWithDiscordInfo')({
  discord_id: Schema.OptionFromNullOr(Discord.Snowflake),
  member_name: Schema.OptionFromNullOr(Schema.String),
  username: Schema.OptionFromNullOr(Schema.String),
  response: EventRsvp.RsvpResponse,
  message: Schema.OptionFromNullOr(Schema.String),
}) {}

class NonResponderRow extends Schema.Class<NonResponderRow>('NonResponderRow')({
  team_member_id: TeamMember.TeamMemberId,
  member_name: Schema.OptionFromNullOr(Schema.String),
  username: Schema.OptionFromNullOr(Schema.String),
  discord_id: Schema.OptionFromNullOr(Discord.Snowflake),
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
    effect: SqlClient.SqlClient.pipe(Effect.bindTo('sql')),
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
      DO UPDATE SET response = ${input.response}, message = COALESCE(${input.message}, event_rsvps.message), updated_at = now()
      RETURNING id, event_id, team_member_id, response, message
    `,
  });

  private upsertClearing = SqlSchema.single({
    Request: UpsertClearInput,
    Result: RsvpRow,
    execute: (input) => this.sql`
      INSERT INTO event_rsvps (event_id, team_member_id, response, message)
      VALUES (${input.event_id}, ${input.team_member_id}, ${input.response}, NULL)
      ON CONFLICT (event_id, team_member_id)
      DO UPDATE SET response = ${input.response}, message = NULL, updated_at = now()
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
      ORDER BY CASE r.response WHEN 'yes' THEN 1 WHEN 'maybe' THEN 2 WHEN 'no' THEN 3 ELSE 99 END ASC, r.created_at ASC
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

  private findYesAttendeesWithLimit = SqlSchema.findAll({
    Request: Schema.Struct({
      event_id: Schema.String,
      limit: Schema.Number,
    }),
    Result: RsvpWithDiscordInfo,
    execute: (input) => this.sql`
      SELECT u.discord_id, u.name AS member_name, u.username, r.response, r.message
      FROM event_rsvps r
      JOIN team_members tm ON tm.id = r.team_member_id
      LEFT JOIN users u ON u.id = tm.user_id
      WHERE r.event_id = ${input.event_id}
        AND r.response = 'yes'
      ORDER BY r.created_at ASC
      LIMIT ${input.limit}
    `,
  });

  private findYesRsvpMemberIds = SqlSchema.findAll({
    Request: Event.EventId,
    Result: Schema.Struct({ team_member_id: TeamMember.TeamMemberId }),
    execute: (eventId) => this.sql`
      SELECT team_member_id
      FROM event_rsvps
      WHERE event_id = ${eventId}
        AND response = 'yes'
    `,
  });

  private findNonResponders = SqlSchema.findAll({
    Request: Schema.Struct({
      event_id: Schema.String,
      team_id: Schema.String,
      member_group_id: Schema.OptionFromNullOr(Schema.String),
    }),
    Result: NonResponderRow,
    execute: (input) => this.sql`
      WITH eligible_members AS (
        SELECT tm.id AS team_member_id, tm.user_id
        FROM team_members tm
        WHERE tm.team_id = ${input.team_id}
          AND tm.active = true
          AND (
            ${input.member_group_id}::uuid IS NULL
            OR tm.id IN (
              WITH RECURSIVE descendant_groups AS (
                SELECT id FROM groups WHERE id = ${input.member_group_id}::uuid
                UNION ALL
                SELECT g.id FROM groups g JOIN descendant_groups dg ON g.parent_id = dg.id
              )
              SELECT gm.team_member_id
              FROM group_members gm
              JOIN descendant_groups dg ON dg.id = gm.group_id
            )
          )
      )
      SELECT em.team_member_id, u.name AS member_name, u.username, u.discord_id
      FROM eligible_members em
      LEFT JOIN users u ON u.id = em.user_id
      LEFT JOIN event_rsvps er ON er.team_member_id = em.team_member_id AND er.event_id = ${input.event_id}
      WHERE er.id IS NULL
      ORDER BY u.name ASC
    `,
  });

  findRsvpsByEventId = (eventId: Event.EventId) => this.findByEventId(eventId).pipe(catchSqlErrors);

  findRsvpByEventAndMember = (eventId: Event.EventId, teamMemberId: TeamMember.TeamMemberId) =>
    this.findByEventAndMember({ event_id: eventId, team_member_id: teamMemberId }).pipe(
      catchSqlErrors,
    );

  upsertRsvp = (
    eventId: Event.EventId,
    teamMemberId: TeamMember.TeamMemberId,
    response: EventRsvp.RsvpResponse,
    message: Option.Option<string>,
    clearMessage = false,
  ) =>
    (clearMessage
      ? this.upsertClearing({ event_id: eventId, team_member_id: teamMemberId, response })
      : this.upsert({ event_id: eventId, team_member_id: teamMemberId, response, message })
    ).pipe(catchSqlErrors);

  countRsvpsByEventId = (eventId: Event.EventId) =>
    this.countByEventId(eventId).pipe(catchSqlErrors);

  findRsvpAttendeesPage = (eventId: Event.EventId, offset: number, limit: number) =>
    this.findAttendeesPage({ event_id: eventId, limit, offset }).pipe(catchSqlErrors);

  findNonRespondersByEventId = (
    eventId: Event.EventId,
    teamId: string,
    memberGroupId: Option.Option<string> = Option.none(),
  ) =>
    this.findNonResponders({
      event_id: eventId,
      team_id: teamId,
      member_group_id: memberGroupId,
    }).pipe(catchSqlErrors);

  countRsvpTotal = (eventId: Event.EventId) =>
    this.countTotalByEventId(eventId).pipe(
      Effect.map(Option.match({ onNone: () => 0, onSome: (r) => r.count })),
      catchSqlErrors,
    );

  findYesAttendeesForEmbed = (eventId: Event.EventId, limit: number) =>
    this.findYesAttendeesWithLimit({ event_id: eventId, limit }).pipe(catchSqlErrors);

  findYesRsvpMemberIdsByEventId = (eventId: Event.EventId) =>
    this.findYesRsvpMemberIds(eventId).pipe(
      Effect.map((rows) => rows.map((r) => r.team_member_id)),
      catchSqlErrors,
    );
}
