import { SqlClient, SqlSchema } from '@effect/sql';
import {
  Discord,
  DiscordChannelMapping,
  SubgroupModel,
  type SubgroupModel as SubgroupModelNS,
  Team,
  type Team as TeamNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class MappingRow extends Schema.Class<MappingRow>('MappingRow')({
  id: DiscordChannelMapping.DiscordChannelMappingId,
  team_id: Team.TeamId,
  subgroup_id: SubgroupModel.SubgroupId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class FindBySubgroupInput extends Schema.Class<FindBySubgroupInput>('FindBySubgroupInput')({
  team_id: Team.TeamId,
  subgroup_id: SubgroupModel.SubgroupId,
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  subgroup_id: SubgroupModel.SubgroupId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Discord.Snowflake,
}) {}

class DeleteBySubgroupInput extends Schema.Class<DeleteBySubgroupInput>('DeleteBySubgroupInput')({
  team_id: Team.TeamId,
  subgroup_id: SubgroupModel.SubgroupId,
}) {}

export class DiscordChannelMappingRepository extends Effect.Service<DiscordChannelMappingRepository>()(
  'api/DiscordChannelMappingRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('findBySubgroup', ({ sql }) =>
        SqlSchema.findOne({
          Request: FindBySubgroupInput,
          Result: MappingRow,
          execute: (input) => sql`
            SELECT id, team_id, subgroup_id, discord_channel_id, discord_role_id
            FROM discord_channel_mappings
            WHERE team_id = ${input.team_id} AND subgroup_id = ${input.subgroup_id}
          `,
        }),
      ),
      Effect.let('insertMapping', ({ sql }) =>
        SqlSchema.void({
          Request: InsertInput,
          execute: (input) => sql`
            INSERT INTO discord_channel_mappings (team_id, subgroup_id, discord_channel_id, discord_role_id)
            VALUES (${input.team_id}, ${input.subgroup_id}, ${input.discord_channel_id}, ${input.discord_role_id})
            ON CONFLICT (team_id, subgroup_id) DO UPDATE SET discord_channel_id = ${input.discord_channel_id}, discord_role_id = ${input.discord_role_id}
          `,
        }),
      ),
      Effect.let('deleteBySubgroup', ({ sql }) =>
        SqlSchema.void({
          Request: DeleteBySubgroupInput,
          execute: (input) => sql`
            DELETE FROM discord_channel_mappings
            WHERE team_id = ${input.team_id} AND subgroup_id = ${input.subgroup_id}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  findBySubgroupId(teamId: TeamNS.TeamId, subgroupId: SubgroupModelNS.SubgroupId) {
    return this.findBySubgroup({ team_id: teamId, subgroup_id: subgroupId });
  }

  insert(
    teamId: TeamNS.TeamId,
    subgroupId: SubgroupModelNS.SubgroupId,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Discord.Snowflake,
  ) {
    return this.insertMapping({
      team_id: teamId,
      subgroup_id: subgroupId,
      discord_channel_id: discordChannelId,
      discord_role_id: discordRoleId,
    });
  }

  deleteBySubgroupId(teamId: TeamNS.TeamId, subgroupId: SubgroupModelNS.SubgroupId) {
    return this.deleteBySubgroup({ team_id: teamId, subgroup_id: subgroupId });
  }
}
