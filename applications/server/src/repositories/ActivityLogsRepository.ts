import { SqlClient, SqlSchema } from '@effect/sql';
import { ActivityLog, TeamMember } from '@sideline/domain';
import { Effect, type Option, Schema } from 'effect';

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_member_id: TeamMember.TeamMemberId,
  activity_type: ActivityLog.ActivityType,
  logged_at: Schema.Date,
  duration_minutes: Schema.OptionFromNullOr(Schema.Int.pipe(Schema.between(1, 1440))),
  note: Schema.OptionFromNullOr(Schema.String),
}) {}

class InsertResult extends Schema.Class<InsertResult>('InsertResult')({
  id: ActivityLog.ActivityLogId,
  activity_type: ActivityLog.ActivityType,
  logged_at: Schema.String,
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
      INSERT INTO activity_logs (team_member_id, activity_type, logged_at, duration_minutes, note)
      VALUES (
        ${input.team_member_id},
        ${input.activity_type},
        ${input.logged_at},
        ${input.duration_minutes},
        ${input.note}
      )
      RETURNING id, activity_type, logged_at::text
    `,
  });

  insert = (input: {
    team_member_id: TeamMember.TeamMemberId;
    activity_type: ActivityLog.ActivityType;
    logged_at: Date;
    duration_minutes: Option.Option<number>;
    note: Option.Option<string>;
  }) =>
    this.insertQuery(input).pipe(
      Effect.catchTag('SqlError', 'ParseError', 'NoSuchElementException', Effect.die),
    );
}
