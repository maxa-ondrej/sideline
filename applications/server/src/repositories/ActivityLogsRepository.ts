import { SqlClient, SqlSchema } from '@effect/sql';
import { ActivityLog, ActivityLogApi, TeamMember } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';

class StatsRow extends Schema.Class<StatsRow>('StatsRow')({
  activity_type: ActivityLog.ActivityType,
  logged_at_date: Schema.String,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int),
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_member_id: TeamMember.TeamMemberId,
  activity_type: ActivityLog.ActivityType,
  logged_at: Schema.Date,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
  note: Schema.OptionFromNullOr(Schema.String),
  source: ActivityLog.ActivitySource,
}) {}

class InsertResult extends Schema.Class<InsertResult>('InsertResult')({
  id: ActivityLog.ActivityLogId,
  activity_type: ActivityLog.ActivityType,
  logged_at: Schema.String,
  source: ActivityLog.ActivitySource,
}) {}

class LogRow extends Schema.Class<LogRow>('LogRow')({
  id: ActivityLog.ActivityLogId,
  team_member_id: TeamMember.TeamMemberId,
  activity_type: ActivityLog.ActivityType,
  logged_at: Schema.DateFromString,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int),
  note: Schema.OptionFromNullOr(Schema.String),
  source: ActivityLog.ActivitySource,
}) {}

class UpdateInput extends Schema.Class<UpdateInput>('UpdateInput')({
  id: ActivityLog.ActivityLogId,
  team_member_id: TeamMember.TeamMemberId,
  activity_type: ActivityLog.ActivityType,
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
      INSERT INTO activity_logs (team_member_id, activity_type, logged_at, duration_minutes, note, source)
      VALUES (
        ${input.team_member_id},
        ${input.activity_type},
        ${input.logged_at},
        ${input.duration_minutes},
        ${input.note},
        ${input.source}
      )
      RETURNING id, activity_type, logged_at::text, source
    `,
  });

  private findAllQuery = SqlSchema.findAll({
    Request: TeamMember.TeamMemberId,
    Result: StatsRow,
    execute: (teamMemberId) => this.sql`
      SELECT
        activity_type,
        (logged_at AT TIME ZONE 'Europe/Prague')::date::text AS logged_at_date,
        duration_minutes
      FROM activity_logs
      WHERE team_member_id = ${teamMemberId}
        AND source = 'manual' -- only manual logs count toward stats to reflect the player's own effort
      ORDER BY logged_at
    `,
  });

  private findByMemberQuery = SqlSchema.findAll({
    Request: TeamMember.TeamMemberId,
    Result: LogRow,
    execute: (teamMemberId) => this.sql`
      SELECT id, team_member_id, activity_type, logged_at::text AS logged_at, duration_minutes, note, source
      FROM activity_logs
      WHERE team_member_id = ${teamMemberId}
      ORDER BY logged_at DESC
      LIMIT 100
    `,
  });

  private findByIdQuery = SqlSchema.findOne({
    Request: FindByIdInput,
    Result: LogRow,
    execute: (input) => this.sql`
      SELECT id, team_member_id, activity_type, logged_at::text AS logged_at, duration_minutes, note, source
      FROM activity_logs
      WHERE id = ${input.id}
        AND team_member_id = ${input.team_member_id}
    `,
  });

  private updateQuery = SqlSchema.single({
    Request: UpdateInput,
    Result: LogRow,
    execute: (input) => this.sql`
      UPDATE activity_logs
      SET
        activity_type = ${input.activity_type},
        duration_minutes = ${input.duration_minutes},
        note = ${input.note}
      WHERE id = ${input.id}
        AND team_member_id = ${input.team_member_id}
      RETURNING id, team_member_id, activity_type, logged_at::text AS logged_at, duration_minutes, note, source
    `,
  });

  private deleteQuery = SqlSchema.void({
    Request: DeleteInput,
    execute: (input) => this.sql`
      DELETE FROM activity_logs WHERE id = ${input.id} AND team_member_id = ${input.team_member_id}
    `,
  });

  private deleteAutoTrainingLogQuery = SqlSchema.void({
    Request: Schema.Struct({
      team_member_id: TeamMember.TeamMemberId,
      date: Schema.Date,
    }),
    execute: (input) => this.sql`
      DELETE FROM activity_logs
      WHERE team_member_id = ${input.team_member_id}
        AND activity_type = 'training'
        AND source = 'auto'
        AND ((logged_at AT TIME ZONE 'UTC')::date) = ((${input.date} AT TIME ZONE 'UTC')::date)
    `,
  });

  findByTeamMember = (teamMemberId: TeamMember.TeamMemberId) =>
    this.findAllQuery(teamMemberId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  findByMember = (teamMemberId: TeamMember.TeamMemberId) =>
    this.findByMemberQuery(teamMemberId).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  findById = (id: ActivityLog.ActivityLogId, memberId: TeamMember.TeamMemberId) =>
    this.findByIdQuery({ id, team_member_id: memberId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  insert = (input: {
    team_member_id: TeamMember.TeamMemberId;
    activity_type: ActivityLog.ActivityType;
    logged_at: Date;
    duration_minutes: Option.Option<number>;
    note: Option.Option<string>;
    source: ActivityLog.ActivitySource;
  }) =>
    this.insertQuery(input).pipe(
      Effect.catchTag('SqlError', 'ParseError', 'NoSuchElementException', Effect.die),
    );

  update = (
    id: ActivityLog.ActivityLogId,
    memberId: TeamMember.TeamMemberId,
    input: {
      activity_type: Option.Option<ActivityLog.ActivityType>;
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
          activity_type: Option.getOrElse(input.activity_type, () => existing.activity_type),
          duration_minutes: Option.match(input.duration_minutes, {
            onNone: () => existing.duration_minutes,
            onSome: (v) => v,
          }),
          note: Option.match(input.note, {
            onNone: () => existing.note,
            onSome: (v) => v,
          }),
        }).pipe(Effect.catchTag('SqlError', 'ParseError', 'NoSuchElementException', Effect.die)),
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
          Effect.catchTag('SqlError', 'ParseError', Effect.die),
        ),
      ),
      Effect.asVoid,
    );

  deleteAutoTrainingLog = (memberId: TeamMember.TeamMemberId, date: Date): Effect.Effect<void> =>
    this.deleteAutoTrainingLogQuery({ team_member_id: memberId, date }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );
}
