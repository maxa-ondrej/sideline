import type { Event } from '@sideline/domain';
import * as m from '@sideline/i18n/messages';

export const eventTypeLabels: Record<Event.EventType, () => string> = {
  training: m.event_type_training,
  match: m.event_type_match,
  tournament: m.event_type_tournament,
  meeting: m.event_type_meeting,
  social: m.event_type_social,
  other: m.event_type_other,
};

export const dayShortLabels: Record<number, () => string> = {
  0: m.event_day_short_0,
  1: m.event_day_short_1,
  2: m.event_day_short_2,
  3: m.event_day_short_3,
  4: m.event_day_short_4,
  5: m.event_day_short_5,
  6: m.event_day_short_6,
};

export const dayFullLabels: Record<number, () => string> = {
  0: m.event_day_0,
  1: m.event_day_1,
  2: m.event_day_2,
  3: m.event_day_3,
  4: m.event_day_4,
  5: m.event_day_5,
  6: m.event_day_6,
};

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const sortDays = (days: number[]): number[] =>
  [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
