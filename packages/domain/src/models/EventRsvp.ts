import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { EventId } from '~/models/Event.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export const EventRsvpId = Schema.String.pipe(Schema.brand('EventRsvpId'));
export type EventRsvpId = typeof EventRsvpId.Type;

export const RsvpResponse = Schema.Literal('yes', 'no', 'maybe');
export type RsvpResponse = typeof RsvpResponse.Type;

export class EventRsvp extends Model.Class<EventRsvp>('EventRsvp')({
  id: Model.Generated(EventRsvpId),
  event_id: EventId,
  team_member_id: TeamMemberId,
  response: RsvpResponse,
  message: Schema.OptionFromNullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
