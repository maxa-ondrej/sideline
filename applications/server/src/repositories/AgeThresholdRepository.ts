import { SqlClient, SqlSchema } from '@effect/sql';
import {
  AgeThresholdRule as AgeThresholdNS,
  Role as RoleNS,
  Team as TeamNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class AgeThresholdWithRoleName extends Schema.Class<AgeThresholdWithRoleName>(
  'AgeThresholdWithRoleName',
)({
  id: AgeThresholdNS.AgeThresholdRuleId,
  team_id: TeamNS.TeamId,
  role_id: RoleNS.RoleId,
  role_name: Schema.String,
  min_age: Schema.NullOr(Schema.Number),
  max_age: Schema.NullOr(Schema.Number),
}) {}

class AgeThresholdRow extends Schema.Class<AgeThresholdRow>('AgeThresholdRow')({
  id: AgeThresholdNS.AgeThresholdRuleId,
  team_id: TeamNS.TeamId,
  role_id: RoleNS.RoleId,
  min_age: Schema.NullOr(Schema.Number),
  max_age: Schema.NullOr(Schema.Number),
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Schema.String,
  role_id: Schema.String,
  min_age: Schema.NullOr(Schema.Number),
  max_age: Schema.NullOr(Schema.Number),
}) {}

class UpdateInput extends Schema.Class<UpdateInput>('UpdateInput')({
  id: AgeThresholdNS.AgeThresholdRuleId,
  min_age: Schema.NullOr(Schema.Number),
  max_age: Schema.NullOr(Schema.Number),
}) {}

class TeamIdResult extends Schema.Class<TeamIdResult>('TeamIdResult')({
  team_id: TeamNS.TeamId,
}) {}

class MemberWithBirthYear extends Schema.Class<MemberWithBirthYear>('MemberWithBirthYear')({
  member_id: Schema.String,
  user_id: Schema.String,
  member_name: Schema.NullOr(Schema.String),
  discord_username: Schema.String,
  birth_year: Schema.NullOr(Schema.Number),
  role_ids: Schema.String,
}) {}

export class AgeThresholdRepository extends Effect.Service<AgeThresholdRepository>()(
  'api/AgeThresholdRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByTeamId', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: AgeThresholdWithRoleName,
          execute: (teamId) => sql`
            SELECT atr.id, atr.team_id, atr.role_id, r.name AS role_name,
                   atr.min_age, atr.max_age
            FROM age_threshold_rules atr
            JOIN roles r ON r.id = atr.role_id
            WHERE atr.team_id = ${teamId}
            ORDER BY r.name ASC
          `,
        }),
      ),
      Effect.let('findById', ({ sql }) =>
        SqlSchema.findOne({
          Request: AgeThresholdNS.AgeThresholdRuleId,
          Result: AgeThresholdRow,
          execute: (id) => sql`
            SELECT id, team_id, role_id, min_age, max_age
            FROM age_threshold_rules WHERE id = ${id}
          `,
        }),
      ),
      Effect.let('insert', ({ sql }) =>
        SqlSchema.single({
          Request: InsertInput,
          Result: AgeThresholdWithRoleName,
          execute: (input) => sql`
            WITH inserted AS (
              INSERT INTO age_threshold_rules (team_id, role_id, min_age, max_age)
              VALUES (${input.team_id}, ${input.role_id}, ${input.min_age}, ${input.max_age})
              RETURNING *
            )
            SELECT i.id, i.team_id, i.role_id, r.name AS role_name, i.min_age, i.max_age
            FROM inserted i
            JOIN roles r ON r.id = i.role_id
          `,
        }),
      ),
      Effect.let('updateRule', ({ sql }) =>
        SqlSchema.single({
          Request: UpdateInput,
          Result: AgeThresholdWithRoleName,
          execute: (input) => sql`
            WITH updated AS (
              UPDATE age_threshold_rules
              SET min_age = ${input.min_age}, max_age = ${input.max_age}
              WHERE id = ${input.id}
              RETURNING *
            )
            SELECT u.id, u.team_id, u.role_id, r.name AS role_name, u.min_age, u.max_age
            FROM updated u
            JOIN roles r ON r.id = u.role_id
          `,
        }),
      ),
      Effect.let('deleteRule', ({ sql }) =>
        SqlSchema.void({
          Request: AgeThresholdNS.AgeThresholdRuleId,
          execute: (id) => sql`DELETE FROM age_threshold_rules WHERE id = ${id}`,
        }),
      ),
      Effect.let('findAllTeamsWithRules', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.Void,
          Result: TeamIdResult,
          execute: () => sql`SELECT DISTINCT team_id FROM age_threshold_rules`,
        }),
      ),
      Effect.let('findMembersWithBirthYears', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.String,
          Result: MemberWithBirthYear,
          execute: (teamId) => sql`
            SELECT tm.id AS member_id, tm.user_id,
                   u.name AS member_name, u.discord_username,
                   u.birth_year,
                   COALESCE(
                     (SELECT string_agg(mr.role_id::text, ',')
                      FROM member_roles mr WHERE mr.team_member_id = tm.id), ''
                   ) AS role_ids
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = ${teamId} AND tm.active = true
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findRulesByTeamId(teamId: TeamNS.TeamId) {
    return this.findByTeamId(teamId);
  }

  findRuleById(ruleId: AgeThresholdNS.AgeThresholdRuleId) {
    return this.findById(ruleId);
  }

  insertRule(
    teamId: TeamNS.TeamId,
    roleId: RoleNS.RoleId,
    minAge: number | null,
    maxAge: number | null,
  ) {
    return this.insert({ team_id: teamId, role_id: roleId, min_age: minAge, max_age: maxAge });
  }

  updateRuleById(
    ruleId: AgeThresholdNS.AgeThresholdRuleId,
    minAge: number | null,
    maxAge: number | null,
  ) {
    return this.updateRule({ id: ruleId, min_age: minAge, max_age: maxAge });
  }

  deleteRuleById(ruleId: AgeThresholdNS.AgeThresholdRuleId) {
    return this.deleteRule(ruleId);
  }

  getAllTeamsWithRules() {
    return this.findAllTeamsWithRules(undefined as undefined).pipe(
      Effect.map((rows) => rows.map((r) => r.team_id)),
    );
  }

  getMembersWithBirthYears(teamId: TeamNS.TeamId) {
    return this.findMembersWithBirthYears(teamId);
  }
}
