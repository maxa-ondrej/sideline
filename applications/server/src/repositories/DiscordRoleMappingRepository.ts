import { Discord, DiscordRoleMapping, Role, Team } from '@sideline/domain';
import { Effect, Layer, Schema, ServiceMap } from 'effect';
import { SqlClient, SqlSchema } from 'effect/unstable/sql';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

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

const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const findByRole = SqlSchema.findOne({
    Request: FindByRoleInput,
    Result: MappingRow,
    execute: (input) => sql`
      SELECT id, team_id, role_id, discord_role_id
      FROM discord_role_mappings
      WHERE team_id = ${input.team_id} AND role_id = ${input.role_id}
    `,
  });

  const insertMapping = SqlSchema.void({
    Request: InsertInput,
    execute: (input) => sql`
      INSERT INTO discord_role_mappings (team_id, role_id, discord_role_id)
      VALUES (${input.team_id}, ${input.role_id}, ${input.discord_role_id})
      ON CONFLICT (team_id, role_id) DO UPDATE SET discord_role_id = ${input.discord_role_id}
    `,
  });

  const deleteByRole = SqlSchema.void({
    Request: DeleteByRoleInput,
    execute: (input) => sql`
      DELETE FROM discord_role_mappings
      WHERE team_id = ${input.team_id} AND role_id = ${input.role_id}
    `,
  });

  const _findAllByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: MappingRow,
    execute: (teamId) => sql`
      SELECT id, team_id, role_id, discord_role_id
      FROM discord_role_mappings
      WHERE team_id = ${teamId}
    `,
  });

  const findByRoleId = (teamId: Team.TeamId, roleId: Role.RoleId) =>
    findByRole({ team_id: teamId, role_id: roleId }).pipe(catchSqlErrors);

  const insert = (teamId: Team.TeamId, roleId: Role.RoleId, discordRoleId: Discord.Snowflake) =>
    insertMapping({
      team_id: teamId,
      role_id: roleId,
      discord_role_id: discordRoleId,
    }).pipe(catchSqlErrors);

  const deleteByRoleId = (teamId: Team.TeamId, roleId: Role.RoleId) =>
    deleteByRole({ team_id: teamId, role_id: roleId }).pipe(catchSqlErrors);

  const findAllByTeam = (teamId: Team.TeamId) => _findAllByTeamId(teamId).pipe(catchSqlErrors);

  return {
    findByRoleId,
    insert,
    deleteByRoleId,
    findAllByTeam,
  };
});

export class DiscordRoleMappingRepository extends ServiceMap.Service<
  DiscordRoleMappingRepository,
  Effect.Success<typeof make>
>()('api/DiscordRoleMappingRepository') {
  static readonly Default = Layer.effect(DiscordRoleMappingRepository, make);
}
