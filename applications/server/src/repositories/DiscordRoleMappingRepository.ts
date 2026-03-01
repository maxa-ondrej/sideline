import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, DiscordRoleMapping, Role, Team } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
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
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findByRole', ({ sql }) =>
        SqlSchema.findOne({
          Request: FindByRoleInput,
          Result: MappingRow,
          execute: (input) => sql`
            SELECT id, team_id, role_id, discord_role_id
            FROM discord_role_mappings
            WHERE team_id = ${input.team_id} AND role_id = ${input.role_id}
          `,
        }),
      ),
      Effect.let('insertMapping', ({ sql }) =>
        SqlSchema.void({
          Request: InsertInput,
          execute: (input) => sql`
            INSERT INTO discord_role_mappings (team_id, role_id, discord_role_id)
            VALUES (${input.team_id}, ${input.role_id}, ${input.discord_role_id})
            ON CONFLICT (team_id, role_id) DO UPDATE SET discord_role_id = ${input.discord_role_id}
          `,
        }),
      ),
      Effect.let('deleteByRole', ({ sql }) =>
        SqlSchema.void({
          Request: DeleteByRoleInput,
          execute: (input) => sql`
            DELETE FROM discord_role_mappings
            WHERE team_id = ${input.team_id} AND role_id = ${input.role_id}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findByRoleId(teamId: Team.TeamId, roleId: Role.RoleId) {
    return this.findByRole({ team_id: teamId, role_id: roleId });
  }

  insert(teamId: Team.TeamId, roleId: Role.RoleId, discordRoleId: Discord.Snowflake) {
    return this.insertMapping({ team_id: teamId, role_id: roleId, discord_role_id: discordRoleId });
  }

  deleteByRoleId(teamId: Team.TeamId, roleId: Role.RoleId) {
    return this.deleteByRole({ team_id: teamId, role_id: roleId });
  }
}
