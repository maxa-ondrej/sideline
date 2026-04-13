import { Schema } from 'effect';
import { Model } from 'effect/unstable/schema';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';
import { TeamMemberId } from '~/models/TeamMember.js';
import { TrainingTypeId } from '~/models/TrainingType.js';

export const EventSeriesId = Schema.String.pipe(Schema.brand('EventSeriesId'));
export type EventSeriesId = typeof EventSeriesId.Type;

export const RecurrenceFrequency = Schema.Literal('weekly', 'biweekly');
export type RecurrenceFrequency = typeof RecurrenceFrequency.Type;

export const DayOfWeek = Schema.Int.pipe(Schema.between(0, 6), Schema.brand('DayOfWeek'));
export type DayOfWeek = typeof DayOfWeek.Type;

export const DaysOfWeek = Schema.Array(DayOfWeek).pipe(Schema.minItems(1), Schema.maxItems(7));
export type DaysOfWeek = typeof DaysOfWeek.Type;

export const EventSeriesStatus = Schema.Literal('active', 'cancelled');
export type EventSeriesStatus = typeof EventSeriesStatus.Type;

export class EventSeries extends Model.Class<EventSeries>('EventSeries')({
  id: Model.Generated(EventSeriesId),
  team_id: TeamId,
  training_type_id: Schema.OptionFromNullOr(TrainingTypeId),
  title: Schema.String,
  description: Schema.OptionFromNullOr(Schema.String),
  start_time: Schema.String,
  end_time: Schema.OptionFromNullOr(Schema.String),
  location: Schema.OptionFromNullOr(Schema.String),
  frequency: RecurrenceFrequency,
  days_of_week: DaysOfWeek,
  start_date: Schema.DateFromSelf,
  end_date: Schema.OptionFromNullOr(Schema.DateFromSelf),
  owner_group_id: Schema.OptionFromNullOr(GroupId),
  member_group_id: Schema.OptionFromNullOr(GroupId),
  status: Model.FieldExcept('update')(EventSeriesStatus),
  created_by: TeamMemberId,
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
