import { SqlClient, SqlSchema } from '@effect/sql';
import {
  ChannelSyncEvent as ChannelSyncEventNS,
  type SubgroupModel as SubgroupModelNS,
  type TeamMember as TeamMemberNS,
  type Team as TeamNS,
} from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Schema.String,
  guild_id: Schema.String,
  event_type: Schema.String,
  subgroup_id: Schema.String,
  subgroup_name: Schema.NullOr(Schema.String),
  team_member_id: Schema.NullOr(Schema.String),
  discord_user_id: Schema.NullOr(Schema.String),
}) {}

class GuildLookupResult extends Schema.Class<GuildLookupResult>('GuildLookupResult')({
  guild_id: Schema.NullOr(Schema.String),
}) {}

class EventRow extends Schema.Class<EventRow>('EventRow')({
  id: ChannelSyncEventNS.ChannelSyncEventId,
  team_id: Schema.String,
  guild_id: Schema.String,
  event_type: ChannelSyncEventNS.ChannelSyncEventType,
  subgroup_id: Schema.String,
  subgroup_name: Schema.NullOr(Schema.String),
  team_member_id: Schema.NullOr(Schema.String),
  discord_user_id: Schema.NullOr(Schema.String),
}) {}

class MarkProcessedInput extends Schema.Class<MarkProcessedInput>('MarkProcessedInput')({
  id: ChannelSyncEventNS.ChannelSyncEventId,
}) {}

class MarkFailedInput extends Schema.Class<MarkFailedInput>('MarkFailedInput')({
  id: ChannelSyncEventNS.ChannelSyncEventId,
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
    teamId: TeamNS.TeamId,
    eventType: ChannelSyncEventNS.ChannelSyncEventType,
    subgroupId: SubgroupModelNS.SubgroupId,
    subgroupName: string | null,
    teamMemberId?: TeamMemberNS.TeamMemberId,
    discordUserId?: string,
  ) {
    return this.lookupGuildId(teamId).pipe(
      Effect.flatMap((opt) =>
        opt._tag === 'Some' && opt.value.guild_id !== null
          ? this.insertEvent({
              team_id: teamId,
              guild_id: opt.value.guild_id,
              event_type: eventType,
              subgroup_id: subgroupId,
              subgroup_name: subgroupName,
              team_member_id: teamMemberId ?? null,
              discord_user_id: discordUserId ?? null,
            })
          : Effect.void,
      ),
    );
  }

  findUnprocessed(limit: number) {
    return this.findUnprocessedEvents(limit);
  }

  markProcessed(id: ChannelSyncEventNS.ChannelSyncEventId) {
    return this.markEventProcessed({ id });
  }

  markFailed(id: ChannelSyncEventNS.ChannelSyncEventId, error: string) {
    return this.markEventFailed({ id, error });
  }
}
