import { SqlClient, SqlSchema } from '@effect/sql';
import {
  ChannelSyncEvent,
  Discord,
  DiscordChannelMapping,
  GroupModel,
  RosterModel,
  Team,
} from '@sideline/domain';
import { Effect, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class MappingRow extends Schema.Class<MappingRow>('MappingRow')({
  id: DiscordChannelMapping.DiscordChannelMappingId,
  team_id: Team.TeamId,
  entity_type: ChannelSyncEvent.ChannelSyncEntityType,
  group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  roster_id: Schema.OptionFromNullOr(RosterModel.RosterId),
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class FindByGroupInput extends Schema.Class<FindByGroupInput>('FindByGroupInput')({
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
}) {}

class FindByRosterInput extends Schema.Class<FindByRosterInput>('FindByRosterInput')({
  team_id: Team.TeamId,
  roster_id: RosterModel.RosterId,
}) {}

class InsertGroupInput extends Schema.Class<InsertGroupInput>('InsertGroupInput')({
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Discord.Snowflake,
}) {}

class InsertGroupWithoutRoleInput extends Schema.Class<InsertGroupWithoutRoleInput>(
  'InsertGroupWithoutRoleInput',
)({
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
  discord_channel_id: Discord.Snowflake,
}) {}

class InsertRosterInput extends Schema.Class<InsertRosterInput>('InsertRosterInput')({
  team_id: Team.TeamId,
  roster_id: RosterModel.RosterId,
  discord_channel_id: Discord.Snowflake,
  discord_role_id: Discord.Snowflake,
}) {}

class DeleteByGroupInput extends Schema.Class<DeleteByGroupInput>('DeleteByGroupInput')({
  team_id: Team.TeamId,
  group_id: GroupModel.GroupId,
}) {}

class DeleteByRosterInput extends Schema.Class<DeleteByRosterInput>('DeleteByRosterInput')({
  team_id: Team.TeamId,
  roster_id: RosterModel.RosterId,
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
      SELECT id, team_id, entity_type, group_id, roster_id, discord_channel_id, discord_role_id
      FROM discord_channel_mappings
      WHERE team_id = ${input.team_id} AND group_id = ${input.group_id}
    `,
  });

  private findByRoster = SqlSchema.findOne({
    Request: FindByRosterInput,
    Result: MappingRow,
    execute: (input) => this.sql`
      SELECT id, team_id, entity_type, group_id, roster_id, discord_channel_id, discord_role_id
      FROM discord_channel_mappings
      WHERE team_id = ${input.team_id} AND roster_id = ${input.roster_id}
    `,
  });

  private insertGroupMapping = SqlSchema.void({
    Request: InsertGroupInput,
    execute: (input) => this.sql`
      INSERT INTO discord_channel_mappings (team_id, entity_type, group_id, discord_channel_id, discord_role_id)
      VALUES (${input.team_id}, 'group', ${input.group_id}, ${input.discord_channel_id}, ${input.discord_role_id})
      ON CONFLICT (team_id, group_id) WHERE group_id IS NOT NULL
      DO UPDATE SET discord_channel_id = ${input.discord_channel_id}, discord_role_id = ${input.discord_role_id}
    `,
  });

  private _upsertGroupWithoutRole = SqlSchema.void({
    Request: InsertGroupWithoutRoleInput,
    execute: (input) => this.sql`
      INSERT INTO discord_channel_mappings (team_id, entity_type, group_id, discord_channel_id)
      VALUES (${input.team_id}, 'group', ${input.group_id}, ${input.discord_channel_id})
      ON CONFLICT (team_id, group_id) WHERE group_id IS NOT NULL
      DO UPDATE SET discord_channel_id = ${input.discord_channel_id}, discord_role_id = NULL
    `,
  });

  private insertRosterMapping = SqlSchema.void({
    Request: InsertRosterInput,
    execute: (input) => this.sql`
      INSERT INTO discord_channel_mappings (team_id, entity_type, roster_id, discord_channel_id, discord_role_id)
      VALUES (${input.team_id}, 'roster', ${input.roster_id}, ${input.discord_channel_id}, ${input.discord_role_id})
      ON CONFLICT (team_id, roster_id) WHERE roster_id IS NOT NULL
      DO UPDATE SET discord_channel_id = ${input.discord_channel_id}, discord_role_id = ${input.discord_role_id}
    `,
  });

  private deleteByGroup = SqlSchema.void({
    Request: DeleteByGroupInput,
    execute: (input) => this.sql`
      DELETE FROM discord_channel_mappings
      WHERE team_id = ${input.team_id} AND group_id = ${input.group_id}
    `,
  });

  private deleteByRoster = SqlSchema.void({
    Request: DeleteByRosterInput,
    execute: (input) => this.sql`
      DELETE FROM discord_channel_mappings
      WHERE team_id = ${input.team_id} AND roster_id = ${input.roster_id}
    `,
  });

  private _findAllByTeamId = SqlSchema.findAll({
    Request: Schema.String,
    Result: MappingRow,
    execute: (teamId) => this.sql`
      SELECT id, team_id, entity_type, group_id, roster_id, discord_channel_id, discord_role_id
      FROM discord_channel_mappings
      WHERE team_id = ${teamId}
    `,
  });

  // Group methods
  findByGroupId = (teamId: Team.TeamId, groupId: GroupModel.GroupId) =>
    this.findByGroup({ team_id: teamId, group_id: groupId }).pipe(catchSqlErrors);

  insert = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Discord.Snowflake,
  ) =>
    this.insertGroupMapping({
      team_id: teamId,
      group_id: groupId,
      discord_channel_id: discordChannelId,
      discord_role_id: discordRoleId,
    }).pipe(catchSqlErrors);

  insertWithoutRole = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    discordChannelId: Discord.Snowflake,
  ) =>
    this._upsertGroupWithoutRole({
      team_id: teamId,
      group_id: groupId,
      discord_channel_id: discordChannelId,
    }).pipe(catchSqlErrors);

  deleteByGroupId = (teamId: Team.TeamId, groupId: GroupModel.GroupId) =>
    this.deleteByGroup({ team_id: teamId, group_id: groupId }).pipe(catchSqlErrors);

  // Roster methods
  findByRosterId = (teamId: Team.TeamId, rosterId: RosterModel.RosterId) =>
    this.findByRoster({ team_id: teamId, roster_id: rosterId }).pipe(catchSqlErrors);

  insertRoster = (
    teamId: Team.TeamId,
    rosterId: RosterModel.RosterId,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Discord.Snowflake,
  ) =>
    this.insertRosterMapping({
      team_id: teamId,
      roster_id: rosterId,
      discord_channel_id: discordChannelId,
      discord_role_id: discordRoleId,
    }).pipe(catchSqlErrors);

  deleteByRosterId = (teamId: Team.TeamId, rosterId: RosterModel.RosterId) =>
    this.deleteByRoster({ team_id: teamId, roster_id: rosterId }).pipe(catchSqlErrors);

  findAllByTeam = (teamId: Team.TeamId) => this._findAllByTeamId(teamId).pipe(catchSqlErrors);
}
