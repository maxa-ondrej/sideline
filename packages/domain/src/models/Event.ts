import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export const EventId = Schema.String.pipe(Schema.brand('EventId'));
export type EventId = typeof EventId.Type;

export const EventType = Schema.Literal(
  'training',
  'match',
  'tournament',
  'meeting',
  'social',
  'other',
);
export type EventType = typeof EventType.Type;

export const EventStatus = Schema.Literal('active', 'cancelled');
export type EventStatus = typeof EventStatus.Type;

export class Event extends Model.Class<Event>('Event')({
  id: Model.Generated(EventId),
  team_id: TeamId,
  training_type_id: Schema.NullOr(TrainingTypeId),
  event_type: EventType,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  event_date: Schema.DateFromSelf,
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  status: Model.FieldExcept('update')(EventStatus),
  created_by: TeamMemberId,
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeInsertFromDate,
}) {}
