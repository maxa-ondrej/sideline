import { SqlClient, SqlSchema } from '@effect/sql';
import { Discord, Event, Team } from '@sideline/domain';
import { Bind } from '@sideline/effect-lib';
import { Effect, Schema } from 'effect';

const EventSyncEventType = Schema.Literal(
  'event_created',
  'event_updated',
  'event_cancelled',
  'rsvp_reminder',
);
type EventSyncEventType = typeof EventSyncEventType.Type;

class InsertInput extends Schema.Class<InsertInput>('InsertInput')({
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: EventSyncEventType,
  event_id: Schema.String,
  event_title: Schema.String,
  event_description: Schema.NullOr(Schema.String),
  event_start_at: Schema.String,
  event_end_at: Schema.NullOr(Schema.String),
  event_location: Schema.NullOr(Schema.String),
  event_event_type: Schema.String,
  discord_target_channel_id: Schema.NullOr(Schema.String),
}) {}

class GuildLookupResult extends Schema.Class<GuildLookupResult>('GuildLookupResult')({
  guild_id: Discord.Snowflake,
}) {}

export class EventSyncEventRow extends Schema.Class<EventSyncEventRow>('EventSyncEventRow')({
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_type: EventSyncEventType,
  event_id: Event.EventId,
  event_title: Schema.String,
  event_description: Schema.NullOr(Schema.String),
  event_start_at: Schema.String,
  event_end_at: Schema.NullOr(Schema.String),
  event_location: Schema.NullOr(Schema.String),
  event_event_type: Schema.String,
  discord_target_channel_id: Schema.NullOr(Schema.String),
}) {}

class MarkProcessedInput extends Schema.Class<MarkProcessedInput>('MarkProcessedInput')({
  id: Schema.String,
}) {}

class MarkFailedInput extends Schema.Class<MarkFailedInput>('MarkFailedInput')({
  id: Schema.String,
  error: Schema.String,
}) {}

export class EventSyncEventsRepository extends Effect.Service<EventSyncEventsRepository>()(
  'api/EventSyncEventsRepository',
  {
    effect: SqlClient.SqlClient.pipe(
      Effect.bindTo('sql'),
      Effect.let('insertEvent', ({ sql }) =>
        SqlSchema.void({
          Request: InsertInput,
          execute: (input) => sql`
            INSERT INTO event_sync_events (team_id, guild_id, event_type, event_id, event_title, event_description, event_start_at, event_end_at, event_location, event_event_type, discord_target_channel_id)
            VALUES (${input.team_id}, ${input.guild_id}, ${input.event_type}, ${input.event_id}, ${input.event_title}, ${input.event_description}, ${input.event_start_at}, ${input.event_end_at}, ${input.event_location}, ${input.event_event_type}, ${input.discord_target_channel_id})
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
          Result: EventSyncEventRow,
          execute: (limit) => sql`
            SELECT id, team_id, guild_id, event_type, event_id, event_title, event_description, event_start_at, event_end_at, event_location, event_event_type, discord_target_channel_id
            FROM event_sync_events
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
            UPDATE event_sync_events SET processed_at = now() WHERE id = ${input.id}
          `,
        }),
      ),
      Effect.let('markEventFailed', ({ sql }) =>
        SqlSchema.void({
          Request: MarkFailedInput,
          execute: (input) => sql`
            UPDATE event_sync_events SET processed_at = now(), error = ${input.error} WHERE id = ${input.id}
          `,
        }),
      ),
      Bind.remove('sql'),
    ),
  },
) {
  emitIfGuildLinked(
    teamId: Team.TeamId,
    eventType: EventSyncEventType,
    eventId: Event.EventId,
    title: string,
    description: string | null,
    startAt: string,
    endAt: string | null,
    location: string | null,
    eventEventType: string,
    discordTargetChannelId?: string | null,
  ) {
    return this.lookupGuildId(teamId).pipe(
      Effect.flatten,
      Effect.flatMap(({ guild_id }) =>
        this.insertEvent({
          team_id: teamId,
          guild_id,
          event_type: eventType,
          event_id: eventId,
          event_title: title,
          event_description: description,
          event_start_at: startAt,
          event_end_at: endAt,
          event_location: location,
          event_event_type: eventEventType,
          discord_target_channel_id: discordTargetChannelId ?? null,
        }),
      ),
      Effect.catchTag('NoSuchElementException', () => Effect.void),
    );
  }

  findUnprocessed(limit: number) {
    return this.findUnprocessedEvents(limit);
  }

  markProcessed(id: string) {
    return this.markEventProcessed({ id });
  }

  markFailed(id: string, error: string) {
    return this.markEventFailed({ id, error });
  }
}
