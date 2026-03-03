import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export const EventSeriesId = Schema.String.pipe(Schema.brand('EventSeriesId'));
export type EventSeriesId = typeof EventSeriesId.Type;

export const RecurrenceFrequency = Schema.Literal('weekly', 'biweekly');
export type RecurrenceFrequency = typeof RecurrenceFrequency.Type;

export const DayOfWeek = Schema.Int.pipe(Schema.between(0, 6), Schema.brand('DayOfWeek'));
export type DayOfWeek = typeof DayOfWeek.Type;

export const EventSeriesStatus = Schema.Literal('active', 'cancelled');
export type EventSeriesStatus = typeof EventSeriesStatus.Type;

export class EventSeries extends Model.Class<EventSeries>('EventSeries')({
  id: Model.Generated(EventSeriesId),
  team_id: TeamId,
  training_type_id: Schema.NullOr(TrainingTypeId),
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  start_time: Schema.String,
  end_time: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
  frequency: RecurrenceFrequency,
  day_of_week: DayOfWeek,
  start_date: Schema.DateFromSelf,
  end_date: Schema.NullOr(Schema.DateFromSelf),
  status: Model.FieldExcept('update')(EventSeriesStatus),
  created_by: TeamMemberId,
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
