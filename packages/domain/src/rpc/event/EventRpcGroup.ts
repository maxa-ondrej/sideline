import { Rpc, RpcGroup } from '@effect/rpc';
import { Schema } from 'effect';
import { Discord, Event, EventRsvp, Team, TrainingType } from '~/index.js';
import { UnprocessedEventSyncEvent } from './EventRpcEvents.js';
import {
  ChannelEventEntry,
  CreateEventForbidden,
  CreateEventInvalidDate,
  CreateEventNotMember,
  CreateEventResult,
  EventDiscordMessage,
  EventEmbedInfo,
  GuildEventListResult,
  GuildNotFound,
  RsvpAttendeeEntry,
  RsvpAttendeesResult,
  RsvpCountsResult,
  RsvpDeadlinePassed,
  RsvpEventNotFound,
  RsvpMemberNotFound,
  RsvpNotGroupMember,
  RsvpReminderSummary,
  SubmitRsvpResult,
  TrainingTypeChoice,
} from './EventRpcModels.js';

export const EventRpcGroup = RpcGroup.make(
  Rpc.make('GetUnprocessedEvents', {
    payload: { limit: Schema.Number },
    success: Schema.Array(UnprocessedEventSyncEvent),
  }),
  Rpc.make('MarkEventProcessed', {
    payload: { id: Schema.String },
  }),
  Rpc.make('MarkEventFailed', {
    payload: { id: Schema.String, error: Schema.String },
  }),
  Rpc.make('SaveDiscordMessageId', {
    payload: {
      event_id: Event.EventId,
      discord_channel_id: Discord.Snowflake,
      discord_message_id: Discord.Snowflake,
    },
  }),
  Rpc.make('GetDiscordMessageId', {
    payload: { event_id: Event.EventId },
    success: Schema.OptionFromNullOr(EventDiscordMessage),
  }),
  Rpc.make('SubmitRsvp', {
    payload: {
      event_id: Event.EventId,
      team_id: Team.TeamId,
      discord_user_id: Discord.Snowflake,
      response: EventRsvp.RsvpResponse,
      message: Schema.OptionFromNullOr(Schema.String),
      clearMessage: Schema.Boolean,
    },
    success: SubmitRsvpResult,
    error: Schema.Union(
      RsvpMemberNotFound,
      RsvpDeadlinePassed,
      RsvpEventNotFound,
      RsvpNotGroupMember,
    ),
  }),
  Rpc.make('GetRsvpCounts', {
    payload: { event_id: Event.EventId },
    success: RsvpCountsResult,
  }),
  Rpc.make('GetEventEmbedInfo', {
    payload: { event_id: Event.EventId },
    success: Schema.OptionFromNullOr(EventEmbedInfo),
  }),
  Rpc.make('GetChannelEvents', {
    payload: { discord_channel_id: Discord.Snowflake },
    success: Schema.Array(ChannelEventEntry),
  }),
  Rpc.make('GetRsvpAttendees', {
    payload: { event_id: Event.EventId, offset: Schema.Number, limit: Schema.Number },
    success: RsvpAttendeesResult,
  }),
  Rpc.make('GetYesAttendeesForEmbed', {
    payload: { event_id: Event.EventId, limit: Schema.Number },
    success: Schema.Array(RsvpAttendeeEntry),
  }),
  Rpc.make('GetRsvpReminderSummary', {
    payload: { event_id: Event.EventId },
    success: RsvpReminderSummary,
  }),
  Rpc.make('GetUpcomingGuildEvents', {
    payload: {
      guild_id: Discord.Snowflake,
      offset: Schema.Number,
      limit: Schema.Number,
    },
    success: GuildEventListResult,
    error: GuildNotFound,
  }),
  Rpc.make('GetTrainingTypesByGuild', {
    payload: { guild_id: Discord.Snowflake },
    success: Schema.Array(TrainingTypeChoice),
  }),
  Rpc.make('CreateEvent', {
    payload: {
      guild_id: Discord.Snowflake,
      discord_user_id: Discord.Snowflake,
      event_type: Event.EventType,
      title: Schema.String,
      start_at: Schema.String,
      end_at: Schema.OptionFromNullOr(Schema.String),
      location: Schema.OptionFromNullOr(Schema.String),
      description: Schema.OptionFromNullOr(Schema.String),
      training_type_id: Schema.OptionFromNullOr(TrainingType.TrainingTypeId),
    },
    success: CreateEventResult,
    error: Schema.Union(CreateEventNotMember, CreateEventForbidden, CreateEventInvalidDate),
  }),
).prefix('Event/');
