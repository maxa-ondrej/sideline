import { SqlClient, SqlSchema } from '@effect/sql';
import { ChannelSyncEvent, Discord, SubgroupModel, Team, TeamMember } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Option, Schema } from 'effect';

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: ChannelSyncEvent.ChannelSyncEventType,
  subgroup_id: Schema.String,
  subgroup_name: Schema.OptionFromNullOr(Schema.String),
  team_member_id: Schema.OptionFromNullOr(TeamMember.TeamMemberId),
  discord_user_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

class GuildLookupResult extends Schema.Class<GuildLookupResult>('GuildLookupResult')({
  guild_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

export class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: ChannelSyncEvent.ChannelSyncEventId,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: ChannelSyncEvent.ChannelSyncEventType,
  subgroup_id: SubgroupModel.SubgroupId,
  subgroup_name: Schema.OptionFromNullOr(Schema.String),
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
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('insertEvent', ({ sql }) =>
        SqlSchema.void({
          Request: InsertInput,
          execute: (input) => sql`
            INSERT INTO channel_sync_events (team_id, guild_id, event_type, subgroup_id, subgroup_name, team_member_id, discord_user_id)
            VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.subgroup_id}, ${input.subgroup_name}, ${input.team_member_id}, ${input.discord_user_id})
          `,
        }),
      ),
      Effect.let('lookupGuildId', ({ sql }) =>
        SqlSchema.findOne({
          Request: Schema.String,
          Result: GuildLookupResult,
          execute: (teamId) => sql`SELECT guild_id FROM teams WHERE id = ${teamId}`,
        }),
      ),
      Effect.let('findUnprocessedEvents', ({ sql }) =>
        SqlSchema.findAll({
          Request: Schema.Number,
          Result: EventRow,
          execute: (limit) => sql`
            SELECT id, team_id, guild_id, event_type, subgroup_id, subgroup_name, team_member_id, discord_user_id
            FROM channel_sync_events
            WHERE processed_at IS NULL
            ORDER BY created_at ASC
            LIMIT ${limit}
          `,
        }),
      ),
      Effect.let('markEventProcessed', ({ sql }) =>
        SqlSchema.void({
          Request: MarkProcessedInput,
          execute: (input) => sql`
            UPDATE channel_sync_events SET processed_at = now() WHERE id = ${input.id}
          `,
        }),
      ),
      Effect.let('markEventFailed', ({ sql }) =>
        SqlSchema.void({
          Request: MarkFailedInput,
          execute: (input) => sql`
            UPDATE channel_sync_events SET processed_at = now(), error = ${input.error} WHERE id = ${input.id}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  emitIfGuildLinked(
    teamId: Team.TeamId,
    eventType: ChannelSyncEvent.ChannelSyncEventType,
    subgroupId: SubgroupModel.SubgroupId,
    subgroupName: Option.Option<string> = Option.none(),
    teamMemberId: Option.Option<TeamMember.TeamMemberId> = Option.none(),
    discordUserId: Option.Option<Discord.Snowflake> = Option.none(),
  ) {
    return this.lookupGuildId(teamId).pipe(
      Effect.flatMap(Option.flatMap(({ guild_id }) => guild_id)),
      Effect.flatMap((guild_id) =>
        this.insertEvent({
          team_id: teamId,
          guild_id,
          event_type: eventType,
          subgroup_id: subgroupId,
          subgroup_name: subgroupName,
          team_member_id: teamMemberId,
          discord_user_id: discordUserId,
        }),
      ),
      Effect.catchTag('NoSuchElementException', () => Effect.void),
    );
  }

  findUnprocessed(limit: number) {
    return this.findUnprocessedEvents(limit);
  }

  markProcessed(id: ChannelSyncEvent.ChannelSyncEventId) {
    return this.markEventProcessed({ id });
  }

  markFailed(id: ChannelSyncEvent.ChannelSyncEventId, error: string) {
    return this.markEventFailed({ id, error });
  }
}
