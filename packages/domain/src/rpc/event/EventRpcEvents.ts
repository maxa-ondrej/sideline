import * as Schemas from '@sideline/effect-lib/Schemas';
import { Schema } from 'effect';
import { Discord, Event, Team } from '~/index.js';

export class EventCreatedEvent extends Schema.TaggedClass<EventCreatedEvent>()('event_created', {
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_id: Event.EventId,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromIsoString,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  location: Schema.OptionFromNullOr(Schema.String),
  event_type: Schema.String,
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

export class EventUpdatedEvent extends Schema.TaggedClass<EventUpdatedEvent>()('event_updated', {
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_id: Event.EventId,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schemas.DateTimeFromIsoString,
  end_at: Schema.OptionFromNullOr(Schemas.DateTimeFromIsoString),
  location: Schema.OptionFromNullOr(Schema.String),
  event_type: Schema.String,
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
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

export class EventStartedEvent extends Schema.TaggedClass<EventStartedEvent>()('event_started', {
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_id: Event.EventId,
}) {}

export class RsvpReminderEvent extends Schema.TaggedClass<RsvpReminderEvent>()('rsvp_reminder', {
  id: Schema.String,
  team_id: Team.TeamId,
  guild_id: Discord.Snowflake,
  event_id: Event.EventId,
  title: Schema.String,
  start_at: Schemas.DateTimeFromIsoString,
  discord_channel_id: Schema.OptionFromNullOr(Discord.Snowflake),
}) {}

export const UnprocessedEventSyncEvent = Schema.Union(
  EventCreatedEvent,
  EventUpdatedEvent,
  EventCancelledEvent,
  EventStartedEvent,
  RsvpReminderEvent,
);

export type UnprocessedEventSyncEvent = Schema.Schema.Type<typeof UnprocessedEventSyncEvent>;
