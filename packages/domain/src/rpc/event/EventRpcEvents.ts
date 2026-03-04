import { Schema } from 'effect';
import { Discord, Event, Team } from '~/index.js';

export class EventCreatedEvent extends Schema.TaggedClass<EventCreatedEvent>()('event_created', {
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_id: Event.EventId,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  event_type: Schema.String,
  discord_channel_id: Schema.NullOr(Schema.String),
}) {}

export class EventUpdatedEvent extends Schema.TaggedClass<EventUpdatedEvent>()('event_updated', {
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_id: Event.EventId,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  event_type: Schema.String,
  discord_channel_id: Schema.NullOr(Schema.String),
}) {}

export class EventCancelledEvent extends Schema.TaggedClass<EventCancelledEvent>()(
  'event_cancelled',
  {
    id: Schema.String,
    team_id: Team.TeamId,
    guild_id: Discord.Snowflake,
    event_id: Event.EventId,
  },
) {}

export const UnprocessedEventSyncEvent = Schema.Union(
  EventCreatedEvent,
  EventUpdatedEvent,
  EventCancelledEvent,
);

export type UnprocessedEventSyncEvent = Schema.Schema.Type<typeof UnprocessedEventSyncEvent>;
