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
}) {}

class MarkProcessedInput extends Schema.Class<MarkProcessedInput>('MarkProcessedInput')({
  id: ChannelSyncEvent.ChannelSyncEventId,
}) {}

class MarkFailedInput extends Schema.Class<MarkFailedInput>('MarkFailedInput')({
  id: ChannelSyncEvent.ChannelSyncEventId,
  error: Schema.String,
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
      INSERT INTO channel_sync_events (team_id, guild_id, event_type, entity_type, group_id, group_name, team_member_id, discord_user_id, roster_id, roster_name, existing_channel_id)
      VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.entity_type}, ${input.group_id}, ${input.group_name}, ${input.team_member_id}, ${input.discord_user_id}, ${input.roster_id}, ${input.roster_name}, ${input.existing_channel_id})
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
      SELECT id, team_id, guild_id, event_type, entity_type, group_id, group_name, team_member_id, discord_user_id, roster_id, roster_name, existing_channel_id
      FROM channel_sync_events
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
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
            }),
        }),
      ),
      catchSqlErrors,
    );

  emitChannelCreated = (teamId: Team.TeamId, groupId: GroupModel.GroupId, groupName: string) =>
    this._emitIfGuildLinked(teamId, 'channel_created', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
    });

  emitChannelDeleted = (teamId: Team.TeamId, groupId: GroupModel.GroupId, groupName: string) =>
    this._emitIfGuildLinked(teamId, 'channel_deleted', 'group', {
      groupId: Option.some(groupId),
      groupName: Option.some(groupName),
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
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_created', 'roster', {
      rosterId: Option.some(rosterId),
      rosterName: Option.some(rosterName),
      existingChannelId,
    });

  emitRosterChannelDeleted = (
    teamId: Team.TeamId,
    rosterId: RosterModel.RosterId,
    rosterName: string,
  ) =>
    this._emitIfGuildLinked(teamId, 'channel_deleted', 'roster', {
      rosterId: Option.some(rosterId),
      rosterName: Option.some(rosterName),
    });

  findUnprocessed = (limit: number) => this.findUnprocessedEvents(limit).pipe(catchSqlErrors);

  markProcessed = (id: ChannelSyncEvent.ChannelSyncEventId) =>
    this.markEventProcessed({ id }).pipe(catchSqlErrors);

  markFailed = (id: ChannelSyncEvent.ChannelSyncEventId, error: string) =>
    this.markEventFailed({ id, error }).pipe(catchSqlErrors);
}
