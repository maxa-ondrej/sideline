import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, DiscordChannelMapping, GroupModel, Team } from '@sideline/domain';
import { Effect, Schema } from 'effect';

class MappingRow extends Schema.Class<MappingRow>('MappingRow')({
  id: DiscordChannelMapping.DiscordChannelMappingId,
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class FindByGroupInput extends Schema.Class<FindByGroupInput>('FindByGroupInput')({
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
}) {}

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Discord.Snowflake,
}) {}

class InsertWithoutRoleInput extends Schema.Class<InsertWithoutRoleInput>('InsertWithoutRoleInput')(
  {
    team_id: Team.TeamId,
    group_id: GroupModel.GroupId,
    discord_channel_id: Discord.Snowflake,
  },
) {}

class DeleteByGroupInput extends Schema.Class<DeleteByGroupInput>('DeleteByGroupInput')({
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
}) {}

export class DiscordChannelMappingRepository extends Effect.Service<DiscordChannelMappingRepository>()(
  'api/DiscordChannelMappingRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private findByGroup = SqlSchema.findOne({
    Request: FindByGroupInput,
    Result: MappingRow,
    execute: (input) => this.sql`
      SELECT id, team_id, group_id, discord_channel_id, discord_role_id
      FROM discord_channel_mappings
      WHERE team_id = ${input.team_id} AND group_id = ${input.group_id}
    `,
  });

  private insertMapping = SqlSchema.void({
    Request: InsertInput,
    execute: (input) => this.sql`
      INSERT INTO discord_channel_mappings (team_id, group_id, discord_channel_id, discord_role_id)
      VALUES (${input.team_id}, ${input.group_id}, ${input.discord_channel_id}, ${input.discord_role_id})
      ON CONFLICT (team_id, group_id) DO UPDATE SET discord_channel_id = ${input.discord_channel_id}, discord_role_id = ${input.discord_role_id}
    `,
  });

  private _upsertWithoutRole = SqlSchema.void({
    Request: InsertWithoutRoleInput,
    execute: (input) => this.sql`
      INSERT INTO discord_channel_mappings (team_id, group_id, discord_channel_id)
      VALUES (${input.team_id}, ${input.group_id}, ${input.discord_channel_id})
      ON CONFLICT (team_id, group_id) DO UPDATE SET discord_channel_id = ${input.discord_channel_id}, discord_role_id = NULL
    `,
  });

  private deleteByGroup = SqlSchema.void({
    Request: DeleteByGroupInput,
    execute: (input) => this.sql`
      DELETE FROM discord_channel_mappings
      WHERE team_id = ${input.team_id} AND group_id = ${input.group_id}
    `,
  });

  private _findAllByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: MappingRow,
    execute: (teamId) => this.sql`
      SELECT id, team_id, group_id, discord_channel_id, discord_role_id
      FROM discord_channel_mappings
      WHERE team_id = ${teamId}
    `,
  });

  findByGroupId = (teamId: Team.TeamId, groupId: GroupModel.GroupId) =>
    this.findByGroup({ team_id: teamId, group_id: groupId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  insert = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Discord.Snowflake,
  ) =>
    this.insertMapping({
      team_id: teamId,
      group_id: groupId,
      discord_channel_id: discordChannelId,
      discord_role_id: discordRoleId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  insertWithoutRole = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    discordChannelId: Discord.Snowflake,
  ) =>
    this._upsertWithoutRole({
      team_id: teamId,
      group_id: groupId,
      discord_channel_id: discordChannelId,
    }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  deleteByGroupId = (teamId: Team.TeamId, groupId: GroupModel.GroupId) =>
    this.deleteByGroup({ team_id: teamId, group_id: groupId }).pipe(
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  findAllByTeam = (teamId: Team.TeamId) =>
    this._findAllByTeamId(teamId).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
}
