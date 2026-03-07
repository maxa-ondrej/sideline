import { SqlClient, SqlSchema } from '@effect/sql';
import { ChannelSyncEvent, Discord, GroupModel, Team, TeamMember } from '@sideline/domain';
import { Effect, Option, Schema } from 'effect';

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: ChannelSyncEvent.ChannelSyncEventType,
  group_id: Schema.String,
  group_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMember.TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class GuildLookupResult extends Schema.Class<GuildLookupResult>('GuildLookupResult')({
  guild_id: Discord.Snowflake,
}) {}

export class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: ChannelSyncEvent.ChannelSyncEventId,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: ChannelSyncEvent.ChannelSyncEventType,
  group_id: GroupModel.GroupId,
  group_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMember.TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Discord.Snowflake),
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
      INSERT INTO channel_sync_events (team_id, guild_id, event_type, group_id, group_name, team_member_id, discord_user_id)
      VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.group_id}, ${input.group_name}, ${input.team_member_id}, ${input.discord_user_id})
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
      SELECT id, team_id, guild_id, event_type, group_id, group_name, team_member_id, discord_user_id
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

  emitIfGuildLinked = (
    teamId: Team.TeamId,
    eventType: ChannelSyncEvent.ChannelSyncEventType,
    groupId: GroupModel.GroupId,
    groupName: Option.Option<string> = Option.none(),
    teamMemberId: Option.Option<TeamMember.TeamMemberId> = Option.none(),
    discordUserId: Option.Option<Discord.Snowflake> = Option.none(),
  ) =>
    this.lookupGuildId(teamId).pipe(
      Effect.flatten,
      Effect.flatMap(({ guild_id }) =>
        this.insertEvent({
          team_id: teamId,
          guild_id,
          event_type: eventType,
          group_id: groupId,
          group_name: groupName,
          team_member_id: teamMemberId,
          discord_user_id: discordUserId,
        }),
      ),
      Effect.catchTag('NoSuchElementException', () => Effect.void),
      Effect.catchTag('SqlError', 'ParseError', Effect.die),
    );

  findUnprocessed = (limit: number) =>
    this.findUnprocessedEvents(limit).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  markProcessed = (id: ChannelSyncEvent.ChannelSyncEventId) =>
    this.markEventProcessed({ id }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));

  markFailed = (id: ChannelSyncEvent.ChannelSyncEventId, error: string) =>
    this.markEventFailed({ id, error }).pipe(Effect.catchTag('SqlError', 'ParseError', Effect.die));
}
