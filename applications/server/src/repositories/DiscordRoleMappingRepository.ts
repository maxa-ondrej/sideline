import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, DiscordRoleMapping, Role, Team } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class MappingRow extends Schema.Class<MappingRow>('MappingRow')({
  id: DiscordRoleMapping.DiscordRoleMappingId,
  team_id: Team.TeamId,
  role_id: Role.RoleId,
  discord_role_id: Discord.Snowflake,
}) {}

class FindByRoleInput extends Schema.Class<FindByRoleInput>('FindByRoleInput')({
  team_id: Team.TeamId,
  role_id: Role.RoleId,
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  role_id: Role.RoleId,
  discord_role_id: Discord.Snowflake,
}) {}

class DeleteByRoleInput extends Schema.Class<DeleteByRoleInput>('DeleteByRoleInput')({
  team_id: Team.TeamId,
  role_id: Role.RoleId,
}) {}

export class DiscordRoleMappingRepository extends Effect.Service<DiscordRoleMappingRepository>()(
  'api/DiscordRoleMappingRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByRole = SqlSchema.findOne({
    Request: FindByRoleInput,
    Result: MappingRow,
    execute: (input) => this.sql`
      SELECT id, team_id, role_id, discord_role_id
      FROM discord_role_mappings
      WHERE team_id = ${input.team_id} AND role_id = ${input.role_id}
    `,
  });

  private insertMapping = SqlSchema.void({
    Request: InsertInput,
    execute: (input) => this.sql`
      INSERT INTO discord_role_mappings (team_id, role_id, discord_role_id)
      VALUES (${input.team_id}, ${input.role_id}, ${input.discord_role_id})
      ON CONFLICT (team_id, role_id) DO UPDATE SET discord_role_id = ${input.discord_role_id}
    `,
  });

  private deleteByRole = SqlSchema.void({
    Request: DeleteByRoleInput,
    execute: (input) => this.sql`
      DELETE FROM discord_role_mappings
      WHERE team_id = ${input.team_id} AND role_id = ${input.role_id}
    `,
  });

  private _findAllByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: MappingRow,
    execute: (teamId) => this.sql`
      SELECT id, team_id, role_id, discord_role_id
      FROM discord_role_mappings
      WHERE team_id = ${teamId}
    `,
  });

  findByRoleId = (teamId: Team.TeamId, roleId: Role.RoleId) =>
    this.findByRole({ team_id: teamId, role_id: roleId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  insert = (teamId: Team.TeamId, roleId: Role.RoleId, discordRoleId: Discord.Snowflake) =>
    this.insertMapping({
      team_id: teamId,
      role_id: roleId,
      discord_role_id: discordRoleId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom));

  deleteByRoleId = (teamId: Team.TeamId, roleId: Role.RoleId) =>
    this.deleteByRole({ team_id: teamId, role_id: roleId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );

  findAllByTeam = (teamId: Team.TeamId) =>
    this._findAllByTeamId(teamId).pipe(
      Effect.catchTag('SqlError', 'ParseError', LogicError.dieFrom),
    );
}
