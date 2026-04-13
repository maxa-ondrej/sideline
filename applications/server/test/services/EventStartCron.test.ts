import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { Event, Team } from '@sideline/domain';
import { DateTime, Effect, Layer, Option } from 'effect';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { eventStartCronEffect } from '~/services/EventStartCron.js';

// --- Test IDs ---
const EVENT_ID_1 = '00000000-0000-0000-0000-000000000001' as Event.EventId;
const EVENT_ID_2 = '00000000-0000-0000-0000-000000000002' as Event.EventId;
const TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;

const START_AT = DateTime.makeUnsafe('2026-04-09T10:00:00Z');
const END_AT = DateTime.makeUnsafe('2026-04-09T12:00:00Z');

// --- In-memory stores ---
type StartableEvent = {
  id: Event.EventId;
  team_id: Team.TeamId;
  title: string;
  description: Option.Option<string>;
  start_at: DateTime.Utc;
  end_at: Option.Option<DateTime.Utc>;
  location: Option.Option<string>;
  event_type: string;
};

type StartedEvent = { eventId: Event.EventId };
type EmittedStarted = { eventId: Event.EventId; teamId: Team.TeamId };

let eventsToStart: StartableEvent[];
let startedEvents: StartedEvent[];
let emittedStarted: EmittedStarted[];

const resetStores = () => {
  eventsToStart = [];
  startedEvents = [];
  emittedStarted = [];
};

// --- Mock layers ---

const MockEventsRepositoryLayer = Layer.succeed(EventsRepository, {
  findEventsToStart: () => Effect.succeed(eventsToStart),
  startEvent: (eventId: Event.EventId) => {
    startedEvents.push({ eventId });
    return Effect.succeed(Option.some({ id: eventId }));
  },
  // Stubs for unused methods
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
  findEndedTrainingsForAutoLog: () => Effect.die(new Error('Not implemented')),
  markTrainingAutoLogged: () => Effect.die(new Error('Not implemented')),
  findUpcomingWithRsvp: () => Effect.die(new Error('Not implemented')),
} as unknown as EventsRepository);

const MockEventSyncEventsRepositoryLayer = Layer.succeed(EventSyncEventsRepository, {
  emitEventStarted: (
    teamId: Team.TeamId,
    eventId: Event.EventId,
    _title: string,
    _description: Option.Option<string>,
    _startAt: DateTime.Utc,
    _endAt: Option.Option<DateTime.Utc>,
    _location: Option.Option<string>,
    _eventType: string,
  ) => {
    emittedStarted.push({ teamId, eventId });
    return Effect.void;
  },
  emitEventCreated: () => Effect.void,
  emitEventUpdated: () => Effect.void,
  emitEventCancelled: () => Effect.void,
  emitRsvpReminder: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as unknown as EventSyncEventsRepository);

const MockProvideLayer = Layer.mergeAll(
  MockEventsRepositoryLayer,
  MockEventSyncEventsRepositoryLayer,
);

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  resetStores();
});

describe('eventStartCronEffect', () => {
  it.effect('marks active events as started and emits sync event', () => {
    eventsToStart = [
      {
        id: EVENT_ID_1,
        team_id: TEAM_ID,
        title: 'Saturday Match',
        description: Option.some('Home match'),
        start_at: START_AT,
        end_at: Option.some(END_AT),
        location: Option.some('Stadium'),
        event_type: 'match',
      },
    ];

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(startedEvents).toHaveLength(1);
          expect(startedEvents[0].eventId).toBe(EVENT_ID_1);
          expect(emittedStarted).toHaveLength(1);
          expect(emittedStarted[0].eventId).toBe(EVENT_ID_1);
          expect(emittedStarted[0].teamId).toBe(TEAM_ID);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('does nothing when no events are ready to start', () => {
    eventsToStart = [];

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(startedEvents).toHaveLength(0);
          expect(emittedStarted).toHaveLength(0);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('processes multiple events in sequence', () => {
    eventsToStart = [
      {
        id: EVENT_ID_1,
        team_id: TEAM_ID,
        title: 'Morning Training',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.none(),
        location: Option.none(),
        event_type: 'training',
      },
      {
        id: EVENT_ID_2,
        team_id: TEAM_ID,
        title: 'Afternoon Match',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.some(END_AT),
        location: Option.some('Away Field'),
        event_type: 'match',
      },
    ];

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(startedEvents).toHaveLength(2);
          expect(startedEvents.map((e) => e.eventId).sort()).toEqual(
            [EVENT_ID_1, EVENT_ID_2].sort(),
          );
          expect(emittedStarted).toHaveLength(2);
          expect(emittedStarted.map((e) => e.eventId).sort()).toEqual(
            [EVENT_ID_1, EVENT_ID_2].sort(),
          );
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('emits sync event after successfully starting the event', () => {
    eventsToStart = [
      {
        id: EVENT_ID_1,
        team_id: TEAM_ID,
        title: 'Training',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.none(),
        location: Option.none(),
        event_type: 'training',
      },
    ];

    // Verify order: startEvent runs first, then emitEventStarted
    const callOrder: string[] = [];

    const OrderTrackingEventsRepo = Layer.succeed(EventsRepository, {
      findEventsToStart: () => Effect.succeed(eventsToStart),
      startEvent: (eventId: Event.EventId) => {
        startedEvents.push({ eventId });
        callOrder.push('startEvent');
        return Effect.succeed(Option.some({ id: eventId }));
      },
    } as unknown as EventsRepository);

    const OrderTrackingSyncRepo = Layer.succeed(EventSyncEventsRepository, {
      emitEventStarted: (teamId: Team.TeamId, eventId: Event.EventId) => {
        emittedStarted.push({ teamId, eventId });
        callOrder.push('emitEventStarted');
        return Effect.void;
      },
    } as unknown as EventSyncEventsRepository);

    const OrderTrackingLayer = Layer.mergeAll(OrderTrackingEventsRepo, OrderTrackingSyncRepo);

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(callOrder).toEqual(['startEvent', 'emitEventStarted']);
        }),
      ),
      Effect.provide(OrderTrackingLayer),
      Effect.asVoid,
    );
  });
});
