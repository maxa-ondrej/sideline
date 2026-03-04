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
