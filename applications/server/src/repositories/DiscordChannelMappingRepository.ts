import { SqlClient, SqlSchema } from '@effect/sql';
import {
  DiscordChannelMapping as DiscordChannelMappingNS,
  SubgroupModel as SubgroupModelNS,
  Team as TeamNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class MappingRow extends Schema.Class<MappingRow>('MappingRow')({
  id: DiscordChannelMappingNS.DiscordChannelMappingId,
  team_id: TeamNS.TeamId,
  subgroup_id: SubgroupModelNS.SubgroupId,
  discord_channel_id: Schema.String,
}) {}

class FindBySubgroupInput extends Schema.Class<FindBySubgroupInput>('FindBySubgroupInput')({
  team_id: Schema.String,
  subgroup_id: Schema.String,
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Schema.String,
  subgroup_id: Schema.String,
  discord_channel_id: Schema.String,
}) {}

class DeleteBySubgroupInput extends Schema.Class<DeleteBySubgroupInput>('DeleteBySubgroupInput')({
  team_id: Schema.String,
  subgroup_id: Schema.String,
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
            SELECT id, team_id, subgroup_id, discord_channel_id
            FROM discord_channel_mappings
            WHERE team_id = ${input.team_id} AND subgroup_id = ${input.subgroup_id}
          `,
        }),
      ),
      Effect.let('insertMapping', ({ sql }) =>
        SqlSchema.void({
          Request: InsertInput,
          execute: (input) => sql`
            INSERT INTO discord_channel_mappings (team_id, subgroup_id, discord_channel_id)
            VALUES (${input.team_id}, ${input.subgroup_id}, ${input.discord_channel_id})
            ON CONFLICT (team_id, subgroup_id) DO UPDATE SET discord_channel_id = ${input.discord_channel_id}
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

  insert(teamId: TeamNS.TeamId, subgroupId: SubgroupModelNS.SubgroupId, discordChannelId: string) {
    return this.insertMapping({
      team_id: teamId,
      subgroup_id: subgroupId,
      discord_channel_id: discordChannelId,
    });
  }

  deleteBySubgroupId(teamId: TeamNS.TeamId, subgroupId: SubgroupModelNS.SubgroupId) {
    return this.deleteBySubgroup({ team_id: teamId, subgroup_id: subgroupId });
  }
}
