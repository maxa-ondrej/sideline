import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { ActivityType, Event, TeamMember } from '@sideline/domain';
import { DateTime, Effect, Layer, Option } from 'effect';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { ActivityTypesRepository } from '~/repositories/ActivityTypesRepository.js';
import { EventRsvpsRepository } from '~/repositories/EventRsvpsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { trainingAutoLogCronEffect } from '~/services/TrainingAutoLogCron.js';

// --- Test IDs ---
const EVENT_ID_1 = '00000000-0000-0000-0000-000000000001' as Event.EventId;
const EVENT_ID_2 = '00000000-0000-0000-0000-000000000002' as Event.EventId;
const MEMBER_ID_1 = '00000000-0000-0000-0000-000000000010' as TeamMember.TeamMemberId;
const MEMBER_ID_2 = '00000000-0000-0000-0000-000000000011' as TeamMember.TeamMemberId;
const TRAINING_TYPE_ID = 'type-uuid-training' as ActivityType.ActivityTypeId;

const START_AT = DateTime.unsafeMake('2026-03-25T09:00:00Z');
const END_AT = DateTime.unsafeMake('2026-03-25T10:30:00Z');

// --- In-memory stores ---
type InsertedLog = {
  team_member_id: TeamMember.TeamMemberId;
  activity_type_id: ActivityType.ActivityTypeId;
  logged_at: Date;
  duration_minutes: Option.Option<number>;
  note: Option.Option<string>;
  source: string;
};

type MarkedEvent = { eventId: Event.EventId };

let insertedLogs: InsertedLog[];
let markedEvents: MarkedEvent[];

// Configurable per-test state
let endedTrainings: Array<{
  id: Event.EventId;
  start_at: DateTime.Utc;
  end_at: Option.Option<DateTime.Utc>;
}>;

let rsvpsByEventId: Map<Event.EventId, TeamMember.TeamMemberId[]>;

let insertShouldThrowUniqueConstraint: boolean;

const resetStores = () => {
  insertedLogs = [];
  markedEvents = [];
  endedTrainings = [];
  rsvpsByEventId = new Map();
  insertShouldThrowUniqueConstraint = false;
};

// --- Mock layers ---

const MockEventsRepositoryLayer = Layer.succeed(EventsRepository, {
  findEndedTrainingsForAutoLog: () => Effect.succeed(endedTrainings),
  markTrainingAutoLogged: (eventId: Event.EventId) => {
    markedEvents.push({ eventId });
    return Effect.void;
  },
  // Stubs for other methods
  findEventsByTeamId: () => Effect.die(new Error('Not implemented')),
  findEventByIdWithDetails: () => Effect.die(new Error('Not implemented')),
  insertEvent: () => Effect.die(new Error('Not implemented')),
  updateEvent: () => Effect.die(new Error('Not implemented')),
  cancelEvent: () => Effect.die(new Error('Not implemented')),
  getScopedTrainingTypeIds: () => Effect.die(new Error('Not implemented')),
  saveDiscordMessageId: () => Effect.die(new Error('Not implemented')),
  getDiscordMessageId: () => Effect.die(new Error('Not implemented')),
  findEventsByChannelId: () => Effect.die(new Error('Not implemented')),
  markReminderSent: () => Effect.die(new Error('Not implemented')),
  markEventSeriesModified: () => Effect.die(new Error('Not implemented')),
  cancelFutureInSeries: () => Effect.die(new Error('Not implemented')),
  updateFutureUnmodifiedInSeries: () => Effect.die(new Error('Not implemented')),
  findUpcomingByGuildId: () => Effect.die(new Error('Not implemented')),
  countUpcomingByGuildId: () => Effect.die(new Error('Not implemented')),
  findEventsByUserId: () => Effect.die(new Error('Not implemented')),
} as unknown as EventsRepository);

const MockEventRsvpsRepositoryLayer = Layer.succeed(EventRsvpsRepository, {
  findYesRsvpMemberIdsByEventId: (eventId: Event.EventId) =>
    Effect.succeed(rsvpsByEventId.get(eventId) ?? []),
  // Stubs for other methods
  findRsvpsByEventId: () => Effect.die(new Error('Not implemented')),
  findRsvpByEventAndMember: () => Effect.die(new Error('Not implemented')),
  upsertRsvp: () => Effect.die(new Error('Not implemented')),
  countRsvpsByEventId: () => Effect.die(new Error('Not implemented')),
  findRsvpAttendeesPage: () => Effect.die(new Error('Not implemented')),
  findNonRespondersByEventId: () => Effect.die(new Error('Not implemented')),
  countRsvpTotal: () => Effect.die(new Error('Not implemented')),
} as unknown as EventRsvpsRepository);

const MockActivityLogsRepositoryLayer = Layer.succeed(ActivityLogsRepository, {
  insert: (input: InsertedLog) => {
    if (insertShouldThrowUniqueConstraint) {
      return Effect.die(new Error('duplicate key value violates unique constraint'));
    }
    insertedLogs.push(input);
    const id = crypto.randomUUID();
    return Effect.succeed({
      id,
      activity_type_id: input.activity_type_id,
      activity_type_name: 'Training',
      logged_at: input.logged_at.toISOString(),
      source: input.source,
    });
  },
  findByTeamMember: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findByMember: () => Effect.succeed([]),
  update: () => Effect.die(new Error('Not implemented')),
  delete: () => Effect.die(new Error('Not implemented')),
} as unknown as ActivityLogsRepository);

const MockActivityTypesRepositoryLayer = Layer.succeed(ActivityTypesRepository, {
  findBySlug: (slug: string) => {
    if (slug === 'training') {
      return Effect.succeed(
        Option.some({ id: TRAINING_TYPE_ID, name: 'Training', slug: Option.some('training') }),
      );
    }
    return Effect.succeed(Option.none());
  },
  findByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
} as unknown as ActivityTypesRepository);

const MockProvideLayer = Layer.mergeAll(
  MockEventsRepositoryLayer,
  MockEventRsvpsRepositoryLayer,
  MockActivityLogsRepositoryLayer,
  MockActivityTypesRepositoryLayer,
);

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  resetStores();
});

describe('trainingAutoLogCronEffect', () => {
  it.effect('creates auto-logs for yes RSVPs of ended training events', () => {
    endedTrainings = [{ id: EVENT_ID_1, start_at: START_AT, end_at: Option.some(END_AT) }];
    rsvpsByEventId.set(EVENT_ID_1, [MEMBER_ID_1, MEMBER_ID_2]);

    return trainingAutoLogCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs).toHaveLength(2);
          expect(insertedLogs.map((l) => l.team_member_id).sort()).toEqual(
            [MEMBER_ID_1, MEMBER_ID_2].sort(),
          );
          expect(insertedLogs[0].activity_type_id).toBe(TRAINING_TYPE_ID);
          expect(insertedLogs[0].source).toBe('auto');
          expect(insertedLogs[1].source).toBe('auto');
          expect(markedEvents).toHaveLength(1);
          expect(markedEvents[0].eventId).toBe(EVENT_ID_1);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('does nothing when no ended trainings found', () => {
    endedTrainings = [];

    return trainingAutoLogCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs).toHaveLength(0);
          expect(markedEvents).toHaveLength(0);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('uses end_at for loggedAt when available', () => {
    endedTrainings = [{ id: EVENT_ID_1, start_at: START_AT, end_at: Option.some(END_AT) }];
    rsvpsByEventId.set(EVENT_ID_1, [MEMBER_ID_1]);

    return trainingAutoLogCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs).toHaveLength(1);
          const expectedDate = DateTime.toDateUtc(END_AT);
          expect(insertedLogs[0].logged_at.toISOString()).toBe(expectedDate.toISOString());
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('uses start_at for loggedAt when end_at is none', () => {
    endedTrainings = [{ id: EVENT_ID_1, start_at: START_AT, end_at: Option.none() }];
    rsvpsByEventId.set(EVENT_ID_1, [MEMBER_ID_1]);

    return trainingAutoLogCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs).toHaveLength(1);
          const expectedDate = DateTime.toDateUtc(START_AT);
          expect(insertedLogs[0].logged_at.toISOString()).toBe(expectedDate.toISOString());
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('handles duplicate insert gracefully (idempotency)', () => {
    endedTrainings = [{ id: EVENT_ID_1, start_at: START_AT, end_at: Option.some(END_AT) }];
    rsvpsByEventId.set(EVENT_ID_1, [MEMBER_ID_1]);
    insertShouldThrowUniqueConstraint = true;

    return trainingAutoLogCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          // Insert was swallowed — no logs recorded in our mock
          expect(insertedLogs).toHaveLength(0);
          // But the event should still be marked as processed
          expect(markedEvents).toHaveLength(1);
          expect(markedEvents[0].eventId).toBe(EVENT_ID_1);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('processes multiple events independently (error isolation)', () => {
    endedTrainings = [
      { id: EVENT_ID_1, start_at: START_AT, end_at: Option.some(END_AT) },
      { id: EVENT_ID_2, start_at: START_AT, end_at: Option.none() },
    ];
    rsvpsByEventId.set(EVENT_ID_1, [MEMBER_ID_1]);
    rsvpsByEventId.set(EVENT_ID_2, [MEMBER_ID_2]);

    // Override the events repo to make the first event processing fail
    const MockEventsRepositoryWithFirstFailing = Layer.succeed(EventsRepository, {
      findEndedTrainingsForAutoLog: () => Effect.succeed(endedTrainings),
      markTrainingAutoLogged: (eventId: Event.EventId) => {
        if (eventId === EVENT_ID_1) {
          return Effect.die(new Error('Simulated failure for event 1'));
        }
        markedEvents.push({ eventId });
        return Effect.void;
      },
    } as unknown as EventsRepository);

    const FailingFirstEventLayer = Layer.mergeAll(
      MockEventsRepositoryWithFirstFailing,
      MockEventRsvpsRepositoryLayer,
      MockActivityLogsRepositoryLayer,
      MockActivityTypesRepositoryLayer,
    );

    return trainingAutoLogCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          // First event's insert still happened (before markAutoLogged failed)
          expect(insertedLogs.some((l) => l.team_member_id === MEMBER_ID_1)).toBe(true);
          // Second event should still be processed despite first failing
          expect(markedEvents).toHaveLength(1);
          expect(markedEvents[0].eventId).toBe(EVENT_ID_2);
          // Second member's log should be inserted
          expect(insertedLogs.some((l) => l.team_member_id === MEMBER_ID_2)).toBe(true);
        }),
      ),
      Effect.provide(FailingFirstEventLayer),
      Effect.asVoid,
    );
  });
});
