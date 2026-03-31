import { SqlClient, SqlSchema } from '@effect/sql';
import {
  ChannelSyncEvent,
  Discord,
  GroupModel,
  RosterModel,
  Team,
  TeamMember,
} from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';
import { catchSqlErrors } from '~/repositories/catchSqlErrors.js';

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: ChannelSyncEvent.ChannelSyncEventType,
  entity_type: ChannelSyncEvent.ChannelSyncEntityType,
  group_id: Schema.OptionFromNullOr(Schema.String),
  group_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMember.TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Discord.Snowflake),
  roster_id: Schema.OptionFromNullOr(RosterModel.RosterId),
  roster_name: Schema.OptionFromNullOr(Schema.String),
  existing_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_role_id: Schema.OptionFromNullOr(Discord.Snowflake),
  archive_category_id: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_name: Schema.OptionFromNullOr(Schema.String),
  discord_role_name: Schema.OptionFromNullOr(Schema.String),
}) {}

class GuildLookupResult extends Schema.Class<GuildLookupResult>('GuildLookupResult')({
  guild_id: Discord.Snowflake,
}) {}

export class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: ChannelSyncEvent.ChannelSyncEventId,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: ChannelSyncEvent.ChannelSyncEventType,
  entity_type: ChannelSyncEvent.ChannelSyncEntityType,
  group_id: Schema.OptionFromNullOr(GroupModel.GroupId),
  group_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMember.TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Discord.Snowflake),
  roster_id: Schema.OptionFromNullOr(RosterModel.RosterId),
  roster_name: Schema.OptionFromNullOr(Schema.String),
  existing_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_role_id: Schema.OptionFromNullOr(Discord.Snowflake),
  archive_category_id: Schema.OptionFromNullOr(Discord.Snowflake),
  discord_channel_name: Schema.OptionFromNullOr(Schema.String),
  discord_role_name: Schema.OptionFromNullOr(Schema.String),
}) {}

class MarkProcessedInput extends Schema.Class<MarkProcessedInput>('MarkProcessedInput')({
  id: ChannelSyncEvent.ChannelSyncEventId,
}) {}

class MarkFailedInput extends Schema.Class<MarkFailedInput>('MarkFailedInput')({
  id: ChannelSyncEvent.ChannelSyncEventId,
  error: Schema.String,
}) {}

class ProvisioningGroupId extends Schema.Class<ProvisioningGroupId>('ProvisioningGroupId')({
  group_id: GroupModel.GroupId,
}) {}

class ProvisioningRosterId extends Schema.Class<ProvisioningRosterId>('ProvisioningRosterId')({
  roster_id: RosterModel.RosterId,
}) {}

export class ChannelSyncEventsRepository extends Effect.Service<ChannelSyncEventsRepository>()(
  'api/ChannelSyncEventsRepository',
  {
    effect: Effect.bindTo(SqlClient.SqlClient, 'sql'),
  },
) {
  private insertEvent = SqlSchema.void({
    Request: InsertInput,
    execute: (input) => this.sql`
      INSERT INTO channel_sync_events (team_id, guild_id, event_type, entity_type, group_id, group_name, team_member_id, discord_user_id, roster_id, roster_name, existing_channel_id, discord_role_id, archive_category_id, discord_channel_name, discord_role_name)
      VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.entity_type}, ${input.group_id}, ${input.group_name}, ${input.team_member_id}, ${input.discord_user_id}, ${input.roster_id}, ${input.roster_name}, ${input.existing_channel_id}, ${input.discord_role_id}, ${input.archive_category_id}, ${input.discord_channel_name}, ${input.discord_role_name})
    `,
  });

  private lookupGuildId = SqlSchema.findOne({
    Request: Schema.String,
    Result: GuildLookupResult,
    execute: (teamId) => this.sql`SELECT guild_id FROM teams WHERE id = ${teamId}`,
  });

  private findUnprocessedEvents = SqlSchema.findAll({
    Request: Schema.Number,
    Result: EventRow,
    execute: (limit) => this.sql`
      SELECT id, team_id, guild_id, event_type, entity_type, group_id, group_name, team_member_id, discord_user_id, roster_id, roster_name, existing_channel_id, discord_role_id, archive_category_id, discord_channel_name, discord_role_name
      FROM channel_sync_events
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
    `,
  });

  private findUnprocessedForGroups = SqlSchema.findAll({
    Request: Schema.Array(GroupModel.GroupId),
    Result: ProvisioningGroupId,
    execute: (groupIds) => this.sql`
      SELECT DISTINCT group_id FROM channel_sync_events
      WHERE entity_type = 'group'
        AND group_id IN ${this.sql.in(groupIds)}
        AND event_type IN ('channel_created', 'channel_deleted', 'channel_archived', 'channel_detached')
        AND processed_at IS NULL AND error IS NULL
    `,
  });

  private findUnprocessedForRosters = SqlSchema.findAll({
    Request: Schema.Array(RosterModel.RosterId),
    Result: ProvisioningRosterId,
    execute: (rosterIds) => this.sql`
      SELECT DISTINCT roster_id FROM channel_sync_events
      WHERE entity_type = 'roster'
        AND roster_id IN ${this.sql.in(rosterIds)}
        AND event_type IN ('channel_created', 'channel_deleted', 'channel_archived', 'channel_detached')
        AND processed_at IS NULL AND error IS NULL
    `,
  });

  private markEventProcessed = SqlSchema.void({
    Request: MarkProcessedInput,
    execute: (input) => this.sql`
      UPDATE channel_sync_events SET processed_at = now() WHERE id = ${input.id}
    `,
  });

  private markEventFailed = SqlSchema.void({
    Request: MarkFailedInput,
    execute: (input) => this.sql`
      UPDATE channel_sync_events SET processed_at = now(), error = ${input.error} WHERE id = ${input.id}
    `,
  });

  private _emitIfGuildLinked = (
    teamId: Team.TeamId,
    eventType: ChannelSyncEvent.ChannelSyncEventType,
    entityType: ChannelSyncEvent.ChannelSyncEntityType,
    fields: {
      groupId?: Option.Option<GroupModel.GroupId>;
      groupName?: Option.Option<string>;
      teamMemberId?: Option.Option<TeamMember.TeamMemberId>;
      discordUserId?: Option.Option<Discord.Snowflake>;
      rosterId?: Option.Option<RosterModel.RosterId>;
      rosterName?: Option.Option<string>;
      existingChannelId?: Option.Option<Discord.Snowflake>;
      discordRoleId?: Option.Option<Discord.Snowflake>;
      archiveCategoryId?: Option.Option<Discord.Snowflake>;
      discordChannelName?: Option.Option<string>;
      discordRoleName?: Option.Option<string>;
    } = {},
  ) =>
    this.lookupGuildId(teamId).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: ({ guild_id }) =>
            this.insertEvent({
              team_id: teamId,
              guild_id,
              event_type: eventType,
              entity_type: entityType,
              group_id: fields.groupId ?? Option.none(),
              group_name: fields.groupName ?? Option.none(),
              team_member_id: fields.teamMemberId ?? Option.none(),
              discord_user_id: fields.discordUserId ?? Option.none(),
              roster_id: fields.rosterId ?? Option.none(),
              roster_name: fields.rosterName ?? Option.none(),
              existing_channel_id: fields.existingChannelId ?? Option.none(),
              discord_role_id: fields.discordRoleId ?? Option.none(),
              archive_category_id: fields.archiveCategoryId ?? Option.none(),
              discord_channel_name: fields.discordChannelName ?? Option.none(),
              discord_role_name: fields.discordRoleName ?? Option.none(),
            }),
        }),
      ),
      catchSqlErrors,
    );

  emitChannelCreated = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    groupName: string,
    existingChannelId: Option.Option<Discord.Snowflake> = Option.none(),
    discordChannelName?: string,
    discordRoleName?: string,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_created', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
      existingChannelId,
      discordChannelName:
        discordChannelName !== undefined ? Option.some(discordChannelName) : Option.none(),
      discordRoleName: discordRoleName !== undefined ? Option.some(discordRoleName) : Option.none(),
    });

  emitChannelDeleted = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    groupName: string,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Option.Option<Discord.Snowflake>,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_deleted', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
      existingChannelId: Option.some(discordChannelId),
      discordRoleId,
    });

  emitMemberAdded = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    groupName: string,
    teamMemberId: TeamMember.TeamMemberId,
    discordUserId: Discord.Snowflake,
  ) =>
    this._emitIfGuildLinked(teamId, 'member_added', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
      teamMemberId: Option.some(teamMemberId),
      discordUserId: Option.some(discordUserId),
    });

  emitMemberRemoved = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    groupName: string,
    teamMemberId: TeamMember.TeamMemberId,
    discordUserId: Discord.Snowflake,
  ) =>
    this._emitIfGuildLinked(teamId, 'member_removed', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
      teamMemberId: Option.some(teamMemberId),
      discordUserId: Option.some(discordUserId),
    });

  emitRosterChannelCreated = (
    teamId: Team.TeamId,
    rosterId: RosterModel.RosterId,
    rosterName: string,
    existingChannelId: Option.Option<Discord.Snowflake> = Option.none(),
    discordChannelName?: string,
    discordRoleName?: string,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_created', 'roster', {
      rosterId: Option.some(rosterId),
      rosterName: Option.some(rosterName),
      existingChannelId,
      discordChannelName:
        discordChannelName !== undefined ? Option.some(discordChannelName) : Option.none(),
      discordRoleName: discordRoleName !== undefined ? Option.some(discordRoleName) : Option.none(),
    });

  emitRosterChannelDeleted = (
    teamId: Team.TeamId,
    rosterId: RosterModel.RosterId,
    rosterName: string,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Option.Option<Discord.Snowflake>,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_deleted', 'roster', {
      rosterId: Option.some(rosterId),
      rosterName: Option.some(rosterName),
      existingChannelId: Option.some(discordChannelId),
      discordRoleId,
    });

  emitChannelArchived = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    groupName: string,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Option.Option<Discord.Snowflake>,
    archiveCategoryId: Discord.Snowflake,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_archived', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
      existingChannelId: Option.some(discordChannelId),
      discordRoleId,
      archiveCategoryId: Option.some(archiveCategoryId),
    });

  emitRosterChannelArchived = (
    teamId: Team.TeamId,
    rosterId: RosterModel.RosterId,
    rosterName: string,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Option.Option<Discord.Snowflake>,
    archiveCategoryId: Discord.Snowflake,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_archived', 'roster', {
      rosterId: Option.some(rosterId),
      rosterName: Option.some(rosterName),
      existingChannelId: Option.some(discordChannelId),
      discordRoleId,
      archiveCategoryId: Option.some(archiveCategoryId),
    });

  emitChannelDetached = (
    teamId: Team.TeamId,
    groupId: GroupModel.GroupId,
    groupName: string,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Option.Option<Discord.Snowflake>,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_detached', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
      existingChannelId: Option.some(discordChannelId),
      discordRoleId,
    });

  emitRosterChannelDetached = (
    teamId: Team.TeamId,
    rosterId: RosterModel.RosterId,
    rosterName: string,
    discordChannelId: Discord.Snowflake,
    discordRoleId: Option.Option<Discord.Snowflake>,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_detached', 'roster', {
      rosterId: Option.some(rosterId),
      rosterName: Option.some(rosterName),
      existingChannelId: Option.some(discordChannelId),
      discordRoleId,
    });

  findUnprocessed = (limit: number) => this.findUnprocessedEvents(limit).pipe(catchSqlErrors);

  markProcessed = (id: ChannelSyncEvent.ChannelSyncEventId) =>
    this.markEventProcessed({ id }).pipe(catchSqlErrors);

  markFailed = (id: ChannelSyncEvent.ChannelSyncEventId, error: string) =>
    this.markEventFailed({ id, error }).pipe(catchSqlErrors);

  hasUnprocessedForGroups = (
    groupIds: ReadonlyArray<GroupModel.GroupId>,
  ): Effect.Effect<ReadonlyArray<GroupModel.GroupId>, never, never> => {
    if (groupIds.length === 0) return Effect.succeed([]);
    return this.findUnprocessedForGroups([...groupIds]).pipe(
      Effect.map((rows) => rows.map((r) => r.group_id)),
      catchSqlErrors,
    );
  };

  hasUnprocessedForRosters = (
    rosterIds: ReadonlyArray<RosterModel.RosterId>,
  ): Effect.Effect<ReadonlyArray<RosterModel.RosterId>, never, never> => {
    if (rosterIds.length === 0) return Effect.succeed([]);
    return this.findUnprocessedForRosters([...rosterIds]).pipe(
      Effect.map((rows) => rows.map((r) => r.roster_id)),
      catchSqlErrors,
    );
  };
}
