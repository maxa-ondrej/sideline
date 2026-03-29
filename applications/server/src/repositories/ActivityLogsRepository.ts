import { SqlClient, SqlSchema } from '@effect/sql';
import { ActivityLog, ActivityLogApi, ActivityType, TeamMember } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Option, Schema } from 'effect';

class StatsRow extends Schema.Class<StatsRow>('StatsRow')({
  activity_type_id: ActivityType.ActivityTypeId,
  activity_type_name: Schema.String,
  logged_at_date: Schema.String,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int),
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_member_id: TeamMember.TeamMemberId,
  activity_type_id: ActivityType.ActivityTypeId,
  logged_at: Schema.Date,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
  note: Schema.OptionFromNullOr(Schema.String),
  source: ActivityLog.ActivitySource,
}) {}

class InsertResult extends Schema.Class<InsertResult>('InsertResult')({
  id: ActivityLog.ActivityLogId,
  activity_type_id: ActivityType.ActivityTypeId,
  activity_type_name: Schema.String,
  logged_at: Schema.String,
  source: ActivityLog.ActivitySource,
}) {}

class LogRow extends Schema.Class<LogRow>('LogRow')({
  id: ActivityLog.ActivityLogId,
  team_member_id: TeamMember.TeamMemberId,
  activity_type_id: ActivityType.ActivityTypeId,
  activity_type_name: Schema.String,
  logged_at: Schema.DateFromString,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int),
  note: Schema.OptionFromNullOr(Schema.String),
  source: ActivityLog.ActivitySource,
}) {}

class UpdateInput extends Schema.Class<UpdateInput>('UpdateInput')({
  id: ActivityLog.ActivityLogId,
  team_member_id: TeamMember.TeamMemberId,
  activity_type_id: ActivityType.ActivityTypeId,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int),
  note: Schema.OptionFromNullOr(Schema.String),
}) {}

class FindByIdInput extends Schema.Class<FindByIdInput>('FindByIdInput')({
  id: ActivityLog.ActivityLogId,
  team_member_id: TeamMember.TeamMemberId,
}) {}

class DeleteInput extends Schema.Class<DeleteInput>('DeleteInput')({
  id: ActivityLog.ActivityLogId,
  team_member_id: TeamMember.TeamMemberId,
}) {}

export class ActivityLogsRepository extends Effect.Service<ActivityLogsRepository>()(
  'api/ActivityLogsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private insertQuery = SqlSchema.single({
    Request: InsertInput,
    Result: InsertResult,
    execute: (input) => this.sql`
      INSERT INTO activity_logs (team_member_id, activity_type_id, logged_at, duration_minutes, note, source)
      VALUES (
        ${input.team_member_id},
        ${input.activity_type_id},
        ${input.logged_at},
        ${input.duration_minutes},
        ${input.note},
        ${input.source}
      )
      RETURNING id, activity_type_id,
        (SELECT name FROM activity_types WHERE id = activity_type_id) AS activity_type_name,
        logged_at::text, source
    `,
  });

  private findAllQuery = SqlSchema.findAll({
    Request: TeamMember.TeamMemberId,
    Result: StatsRow,
    execute: (teamMemberId) => this.sql`
      SELECT
        al.activity_type_id,
        at.name AS activity_type_name,
        (al.logged_at AT TIME ZONE 'Europe/Prague')::date::text AS logged_at_date,
        al.duration_minutes
      FROM activity_logs al
      JOIN activity_types at ON at.id = al.activity_type_id
      WHERE al.team_member_id = ${teamMemberId}
      ORDER BY al.logged_at
    `,
  });

  private findByMemberQuery = SqlSchema.findAll({
    Request: TeamMember.TeamMemberId,
    Result: LogRow,
    execute: (teamMemberId) => this.sql`
      SELECT al.id, al.team_member_id, al.activity_type_id, at.name AS activity_type_name,
             al.logged_at::text AS logged_at, al.duration_minutes, al.note, al.source
      FROM activity_logs al
      JOIN activity_types at ON at.id = al.activity_type_id
      WHERE al.team_member_id = ${teamMemberId}
      ORDER BY al.logged_at DESC
      LIMIT 100
    `,
  });

  private findByIdQuery = SqlSchema.findOne({
    Request: FindByIdInput,
    Result: LogRow,
    execute: (input) => this.sql`
      SELECT al.id, al.team_member_id, al.activity_type_id, at.name AS activity_type_name,
             al.logged_at::text AS logged_at, al.duration_minutes, al.note, al.source
      FROM activity_logs al
      JOIN activity_types at ON at.id = al.activity_type_id
      WHERE al.id = ${input.id}
        AND al.team_member_id = ${input.team_member_id}
    `,
  });

  private updateQuery = SqlSchema.single({
    Request: UpdateInput,
    Result: LogRow,
    execute: (input) => this.sql`
      UPDATE activity_logs
      SET
        activity_type_id = ${input.activity_type_id},
        duration_minutes = ${input.duration_minutes},
        note = ${input.note}
      WHERE id = ${input.id}
        AND team_member_id = ${input.team_member_id}
      RETURNING id, team_member_id, activity_type_id,
        (SELECT name FROM activity_types WHERE id = activity_type_id) AS activity_type_name,
        logged_at::text AS logged_at, duration_minutes, note, source
    `,
  });

  private deleteQuery = SqlSchema.void({
    Request: DeleteInput,
    execute: (input) => this.sql`
      DELETE FROM activity_logs WHERE id = ${input.id} AND team_member_id = ${input.team_member_id}
    `,
  });

  findByTeamMember = (teamMemberId: TeamMember.TeamMemberId) =>
    this.findAllQuery(teamMemberId).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  findByMember = (teamMemberId: TeamMember.TeamMemberId) =>
    this.findByMemberQuery(teamMemberId).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  findById = (id: ActivityLog.ActivityLogId, memberId: TeamMember.TeamMemberId) =>
    this.findByIdQuery({ id, team_member_id: memberId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  insert = (input: {
    team_member_id: TeamMember.TeamMemberId;
    activity_type_id: ActivityType.ActivityTypeId;
    logged_at: Date;
    duration_minutes: Option.Option<number>;
    note: Option.Option<string>;
    source: ActivityLog.ActivitySource;
  }) =>
    this.insertQuery(input).pipe(
      Effect.catchTag('SqlError', 'ParseError', 'NoSuchElementException', LogicError.dieFrom),
    );

  update = (
    id: ActivityLog.ActivityLogId,
    memberId: TeamMember.TeamMemberId,
    input: {
      activity_type_id: Option.Option<ActivityType.ActivityTypeId>;
      duration_minutes: Option.Option<Option.Option<number>>;
      note: Option.Option<Option.Option<string>>;
    },
  ): Effect.Effect<LogRow, ActivityLogApi.LogNotFound | ActivityLogApi.AutoSourceForbidden> =>
    Effect.Do.pipe(
      Effect.bind('existing', () =>
        this.findById(id, memberId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new ActivityLogApi.LogNotFound()),
              onSome: Effect.succeed,
            }),
          ),
        ),
      ),
      Effect.tap(({ existing }) =>
        existing.source === 'auto'
          ? Effect.fail(new ActivityLogApi.AutoSourceForbidden())
          : Effect.void,
      ),
      Effect.flatMap(({ existing }) =>
        this.updateQuery({
          id,
          team_member_id: memberId,
          activity_type_id: Option.getOrElse(
            input.activity_type_id,
            () => existing.activity_type_id,
          ),
          duration_minutes: Option.match(input.duration_minutes, {
            onNone: () => existing.duration_minutes,
            onSome: (v) => v,
          }),
          note: Option.match(input.note, {
            onNone: () => existing.note,
            onSome: (v) => v,
          }),
        }).pipe(
          Effect.catchTag('SqlError', 'ParseError', 'NoSuchElementException', LogicError.dieFrom),
        ),
      ),
    );

  delete = (
    id: ActivityLog.ActivityLogId,
    memberId: TeamMember.TeamMemberId,
  ): Effect.Effect<void, ActivityLogApi.LogNotFound | ActivityLogApi.AutoSourceForbidden> =>
    Effect.Do.pipe(
      Effect.bind('existing', () =>
        this.findById(id, memberId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new ActivityLogApi.LogNotFound()),
              onSome: Effect.succeed,
            }),
          ),
        ),
      ),
      Effect.tap(({ existing }) =>
        existing.source === 'auto'
          ? Effect.fail(new ActivityLogApi.AutoSourceForbidden())
          : Effect.void,
      ),
      Effect.flatMap(() =>
        this.deleteQuery({ id, team_member_id: memberId }).pipe(
          Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
        ),
      ),
      Effect.asVoid,
    );
}
