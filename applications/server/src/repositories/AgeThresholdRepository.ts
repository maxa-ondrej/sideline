import { SqlClient, SqlSchema } from '@effect/sql';
import {
  AgeThresholdRule as AgeThreshold,
  Discord,
  GroupModel,
  Team,
  TeamMember,
  User,
} from '@sideline/domain';
import { Schemas } from '@sideline/effect-lib';
import { Effect, type Option, Schema } from 'effect';

export class AgeThresholdWithGroupName extends Schema.Class<AgeThresholdWithGroupName>(
  'AgeThresholdWithGroupName',
)({
  id: AgeThreshold.AgeThresholdRuleId,
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
  group_name: Schema.String,
  min_age: Schema.OptionFromNullOr(Schema.Number),
  max_age: Schema.OptionFromNullOr(Schema.Number),
}) {}

export class AgeThresholdRow extends Schema.Class<AgeThresholdRow>('AgeThresholdRow')({
  id: AgeThreshold.AgeThresholdRuleId,
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
  min_age: Schema.OptionFromNullOr(Schema.Number),
  max_age: Schema.OptionFromNullOr(Schema.Number),
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Schema.String,
  group_id: Schema.String,
  min_age: Schema.OptionFromNullOr(Schema.Number),
  max_age: Schema.OptionFromNullOr(Schema.Number),
}) {}

class UpdateInput extends Schema.Class<UpdateInput>('UpdateInput')({
  id: AgeThreshold.AgeThresholdRuleId,
  min_age: Schema.OptionFromNullOr(Schema.Number),
  max_age: Schema.OptionFromNullOr(Schema.Number),
}) {}

class TeamIdResult extends Schema.Class<TeamIdResult>('TeamIdResult')({
  team_id: Team.TeamId,
}) {}

export class MemberWithBirthDate extends Schema.Class<MemberWithBirthDate>('MemberWithBirthDate')({
  member_id: TeamMember.TeamMemberId,
  user_id: User.UserId,
  member_name: Schema.OptionFromNullOr(Schema.String),
  username: Schema.String,
  discord_id: Discord.Snowflake,
  birth_date: Schema.String,
  is_admin: Schema.Boolean,
  group_ids: Schemas.ArrayFromSplitString(),
}) {}

export class AgeThresholdRepository extends Effect.Service<AgeThresholdRepository>()(
  'api/AgeThresholdRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: AgeThresholdWithGroupName,
    execute: (teamId) => this.sql`
            SELECT atr.id, atr.team_id, atr.group_id, g.name AS group_name,
                   atr.min_age, atr.max_age
            FROM age_threshold_rules atr
            JOIN groups g ON g.id = atr.group_id
            WHERE atr.team_id = ${teamId}
            ORDER BY g.name ASC
          `,
  });

  private findByIdQuery = SqlSchema.findOne({
    Request: AgeThreshold.AgeThresholdRuleId,
    Result: AgeThresholdRow,
    execute: (id) => this.sql`
            SELECT id, team_id, group_id, min_age, max_age
            FROM age_threshold_rules WHERE id = ${id}
          `,
  });

  private insertQuery = SqlSchema.single({
    Request: InsertInput,
    Result: AgeThresholdWithGroupName,
    execute: (input) => this.sql`
            WITH inserted AS (
              INSERT INTO age_threshold_rules (team_id, group_id, min_age, max_age)
              VALUES (${input.team_id}, ${input.group_id}, ${input.min_age}, ${input.max_age})
              RETURNING *
            )
            SELECT i.id, i.team_id, i.group_id, g.name AS group_name, i.min_age, i.max_age
            FROM inserted i
            JOIN groups g ON g.id = i.group_id
          `,
  });

  private updateRule = SqlSchema.single({
    Request: UpdateInput,
    Result: AgeThresholdWithGroupName,
    execute: (input) => this.sql`
            WITH updated AS (
              UPDATE age_threshold_rules
              SET min_age = ${input.min_age}, max_age = ${input.max_age}
              WHERE id = ${input.id}
              RETURNING *
            )
            SELECT u.id, u.team_id, u.group_id, g.name AS group_name, u.min_age, u.max_age
            FROM updated u
            JOIN groups g ON g.id = u.group_id
          `,
  });

  private deleteRule = SqlSchema.void({
    Request: AgeThreshold.AgeThresholdRuleId,
    execute: (id) => this.sql`DELETE FROM age_threshold_rules WHERE id = ${id}`,
  });

  private findAllTeamsWithRulesQuery = SqlSchema.findAll({
    Request: Schema.Void,
    Result: TeamIdResult,
    execute: () => this.sql`SELECT DISTINCT team_id FROM age_threshold_rules`,
  });

  private findMembersWithBirthDatesQuery = SqlSchema.findAll({
    Request: Schema.String,
    Result: MemberWithBirthDate,
    execute: (teamId) => this.sql`
            SELECT tm.id AS member_id, tm.user_id,
                   u.name AS member_name, u.username, u.discord_id,
                   u.birth_date::text AS birth_date,
                   COALESCE(
                     (SELECT string_agg(gm.group_id::text, ',')
                      FROM group_members gm WHERE gm.team_member_id = tm.id), ''
                   ) AS group_ids,
                    (SELECT count(*)
                      FROM member_roles mr
                      JOIN roles r ON r.id = mr.role_id
                      WHERE mr.team_member_id = tm.id
                      AND r.name = 'Admin') > 0 AS is_admin
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = ${teamId} AND tm.active = true AND u.birth_date IS NOT NULL
          `,
  });

  findRulesByTeamId = (teamId: Team.TeamId) => this.findByTeamId(teamId).pipe(Effect.orDie);

  findRuleById = (ruleId: AgeThreshold.AgeThresholdRuleId) =>
    this.findByIdQuery(ruleId).pipe(Effect.orDie);

  insertRule = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    minAge: Option.Option<number>,
    maxAge: Option.Option<number>,
  ) =>
    this.insertQuery({
      team_id: teamId,
      group_id: groupId,
      min_age: minAge,
      max_age: maxAge,
    }).pipe(Effect.orDie);

  updateRuleById = (
    ruleId: AgeThreshold.AgeThresholdRuleId,
    minAge: Option.Option<number>,
    maxAge: Option.Option<number>,
  ) => this.updateRule({ id: ruleId, min_age: minAge, max_age: maxAge }).pipe(Effect.orDie);

  deleteRuleById = (ruleId: AgeThreshold.AgeThresholdRuleId) =>
    this.deleteRule(ruleId).pipe(Effect.orDie);

  getAllTeamsWithRules = () =>
    this.findAllTeamsWithRulesQuery(void 0).pipe(
      Effect.map((rows) => rows.map((r) => r.team_id)),
      Effect.orDie,
    );

  getMembersWithBirthDates = (teamId: Team.TeamId) =>
    this.findMembersWithBirthDatesQuery(teamId).pipe(Effect.orDie);
}
