import { Schema } from 'effect';

export class EventDiscordMessage extends Schema.Class<EventDiscordMessage>('EventDiscordMessage')({
  discord_channel_id: Schema.String,
  discord_message_id: Schema.String,
}) {}

export class RsvpCountsResult extends Schema.Class<RsvpCountsResult>('RsvpCountsResult')({
  yesCount: Schema.Number,
  noCount: Schema.Number,
  maybeCount: Schema.Number,
  canRsvp: Schema.Boolean,
}) {}

export class EventEmbedInfo extends Schema.Class<EventEmbedInfo>('EventEmbedInfo')({
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  event_type: Schema.String,
}) {}

export class ChannelEventEntry extends Schema.Class<ChannelEventEntry>('ChannelEventEntry')({
  event_id: Schema.String,
  team_id: Schema.String,
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_at: Schema.String,
  end_at: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  event_type: Schema.String,
  status: Schema.String,
  discord_message_id: Schema.String,
}) {}

export class RsvpMemberNotFound extends Schema.TaggedError<RsvpMemberNotFound>()(
  'RsvpMemberNotFound',
  {},
) {}

export class RsvpDeadlinePassed extends Schema.TaggedError<RsvpDeadlinePassed>()(
  'RsvpDeadlinePassed',
  {},
) {}

export class RsvpEventNotFound extends Schema.TaggedError<RsvpEventNotFound>()(
  'RsvpEventNotFound',
  {},
) {}

export class CreateEventNotMember extends Schema.TaggedError<CreateEventNotMember>()(
  'CreateEventNotMember',
  {},
) {}

export class CreateEventForbidden extends Schema.TaggedError<CreateEventForbidden>()(
  'CreateEventForbidden',
  {},
) {}

export class CreateEventInvalidDate extends Schema.TaggedError<CreateEventInvalidDate>()(
  'CreateEventInvalidDate',
  {},
) {}

export class CreateEventResult extends Schema.Class<CreateEventResult>('CreateEventResult')({
  event_id: Schema.String,
  title: Schema.String,
}) {}

export class RsvpAttendeeEntry extends Schema.Class<RsvpAttendeeEntry>('RsvpAttendeeEntry')({
  discord_id: Schema.OptionFromNullOr(Schema.String),
  name: Schema.OptionFromNullOr(Schema.String),
  response: Schema.Literal('yes', 'no', 'maybe'),
  message: Schema.OptionFromNullOr(Schema.String),
}) {}

export class RsvpAttendeesResult extends Schema.Class<RsvpAttendeesResult>('RsvpAttendeesResult')({
  attendees: Schema.Array(RsvpAttendeeEntry),
  total: Schema.Number,
}) {}

export class NonResponderRpcEntry extends Schema.Class<NonResponderRpcEntry>(
  'NonResponderRpcEntry',
)({
  discord_id: Schema.OptionFromNullOr(Schema.String),
  name: Schema.OptionFromNullOr(Schema.String),
  username: Schema.OptionFromNullOr(Schema.String),
}) {}

export class RsvpReminderSummary extends Schema.Class<RsvpReminderSummary>('RsvpReminderSummary')({
  yesCount: Schema.Number,
  noCount: Schema.Number,
  maybeCount: Schema.Number,
  nonResponders: Schema.Array(NonResponderRpcEntry),
}) {}
