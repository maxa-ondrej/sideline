// NOTE (TDD additions at bottom): new tests reference extended types/signatures
// (member_group_id, discord_channel_id, discord_role_id on startable events;
// emitEventStarted accepting those extra fields; resolveReminderChannel helper).
// Those additions will FAIL to compile until the developer implements the server task.

import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { Discord, Event, GroupModel, Team } from '@sideline/domain';
import { DateTime, Effect, Layer, Option } from 'effect';
import { DiscordChannelMappingRepository } from '~/repositories/DiscordChannelMappingRepository.js';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { eventStartCronEffect } from '~/services/EventStartCron.js';

// --- Test IDs ---
const EVENT_ID_1 = '00000000-0000-0000-0000-000000000001' as Event.EventId;
const EVENT_ID_2 = '00000000-0000-0000-0000-000000000002' as Event.EventId;
const TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const GROUP_ID_A = '00000000-0000-0000-0000-000000000030' as GroupModel.GroupId;
const CHANNEL_OWNER = '222222222222222222' as Discord.Snowflake;
const ROLE_ID = '333333333333333333' as Discord.Snowflake;

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
  // New fields added by the fix/improve-reminders-feature branch
  member_group_id: Option.Option<GroupModel.GroupId>;
  discord_target_channel_id: Option.Option<Discord.Snowflake>;
  owner_group_id: Option.Option<GroupModel.GroupId>;
  reminders_channel_id: Option.Option<Discord.Snowflake>;
};

type StartedEvent = { eventId: Event.EventId };
type EmittedStarted = {
  eventId: Event.EventId;
  teamId: Team.TeamId;
  memberGroupId: Option.Option<GroupModel.GroupId>;
  discordChannelId: Option.Option<Discord.Snowflake>;
  discordRoleId: Option.Option<Discord.Snowflake>;
};

let eventsToStart: StartableEvent[];
let startedEvents: StartedEvent[];
let emittedStarted: EmittedStarted[];
let channelMappings: Map<
  string,
  { discord_channel_id: Discord.Snowflake; discord_role_id: Option.Option<Discord.Snowflake> }
>;

const resetStores = () => {
  eventsToStart = [];
  startedEvents = [];
  emittedStarted = [];
  channelMappings = new Map();
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
} as any);

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
    discordChannelId: Option.Option<Discord.Snowflake>,
    memberGroupId: Option.Option<GroupModel.GroupId>,
    discordRoleId: Option.Option<Discord.Snowflake>,
  ) => {
    emittedStarted.push({ teamId, eventId, memberGroupId, discordChannelId, discordRoleId });
    return Effect.void;
  },
  emitEventCreated: () => Effect.void,
  emitEventUpdated: () => Effect.void,
  emitEventCancelled: () => Effect.void,
  emitRsvpReminder: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as any);

const MockChannelMappingRepositoryLayer = Layer.succeed(DiscordChannelMappingRepository, {
  findByGroupId: (teamId: Team.TeamId, groupId: GroupModel.GroupId) => {
    const key = `${teamId}:${groupId}`;
    const mapping = channelMappings.get(key);
    return Effect.succeed(mapping ? Option.some(mapping) : Option.none());
  },
  insert: () => Effect.void,
  insertWithoutRole: () => Effect.void,
  deleteByGroupId: () => Effect.void,
  findAllByTeamId: () => Effect.succeed([]),
  findAllByTeam: () => Effect.succeed([]),
} as any);

const MockProvideLayer = Layer.mergeAll(
  MockEventsRepositoryLayer,
  MockEventSyncEventsRepositoryLayer,
  MockChannelMappingRepositoryLayer,
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
        member_group_id: Option.none(),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
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
        member_group_id: Option.none(),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
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
        member_group_id: Option.none(),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
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
        member_group_id: Option.none(),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
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
    } as any);

    const OrderTrackingSyncRepo = Layer.succeed(EventSyncEventsRepository, {
      emitEventStarted: (
        teamId: Team.TeamId,
        eventId: Event.EventId,
        _title: string,
        _description: Option.Option<string>,
        _startAt: DateTime.Utc,
        _endAt: Option.Option<DateTime.Utc>,
        _location: Option.Option<string>,
        _eventType: string,
        discordChannelId: Option.Option<Discord.Snowflake>,
        memberGroupId: Option.Option<GroupModel.GroupId>,
        discordRoleId: Option.Option<Discord.Snowflake>,
      ) => {
        emittedStarted.push({ teamId, eventId, memberGroupId, discordChannelId, discordRoleId });
        callOrder.push('emitEventStarted');
        return Effect.void;
      },
    } as any);

    const OrderTrackingLayer = Layer.mergeAll(
      OrderTrackingEventsRepo,
      OrderTrackingSyncRepo,
      MockChannelMappingRepositoryLayer,
    );

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

  // --- New TDD tests for fix/improve-reminders-feature ---

  it.effect(
    'preserves NoSuchElementError catch around startEvent (event gone before start)',
    () => {
      eventsToStart = [
        {
          id: EVENT_ID_1,
          team_id: TEAM_ID,
          title: 'Gone Event',
          description: Option.none(),
          start_at: START_AT,
          end_at: Option.none(),
          location: Option.none(),
          event_type: 'training',
          member_group_id: Option.none(),
          discord_target_channel_id: Option.none(),
          owner_group_id: Option.none(),
          reminders_channel_id: Option.none(),
        },
      ];

      const ReturnsNoneRepo = Layer.succeed(EventsRepository, {
        findEventsToStart: () => Effect.succeed(eventsToStart),
        // startEvent returns None → triggers NoSuchElementError path
        startEvent: (_eventId: Event.EventId) => Effect.succeed(Option.none()),
      } as any);

      return eventStartCronEffect.pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            // Should not throw — NoSuchElementError is caught and logged
            expect(emittedStarted).toHaveLength(0);
          }),
        ),
        Effect.provide(
          Layer.mergeAll(
            ReturnsNoneRepo,
            MockEventSyncEventsRepositoryLayer,
            MockChannelMappingRepositoryLayer,
          ),
        ),
        Effect.asVoid,
      );
    },
  );

  it.effect('per-event error isolation: second event still processed when first fails', () => {
    eventsToStart = [
      {
        id: EVENT_ID_1,
        team_id: TEAM_ID,
        title: 'Failing Event',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.none(),
        location: Option.none(),
        event_type: 'training',
        member_group_id: Option.none(),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
      },
      {
        id: EVENT_ID_2,
        team_id: TEAM_ID,
        title: 'Succeeding Event',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.none(),
        location: Option.none(),
        event_type: 'training',
        member_group_id: Option.none(),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
      },
    ];

    const PartiallyFailingEventsRepo = Layer.succeed(EventsRepository, {
      findEventsToStart: () => Effect.succeed(eventsToStart),
      startEvent: (eventId: Event.EventId) => {
        if (eventId === EVENT_ID_1) return Effect.die(new Error('Simulated start failure'));
        startedEvents.push({ eventId });
        return Effect.succeed(Option.some({ id: eventId }));
      },
    } as any);

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          // Second event should succeed despite first failing
          expect(startedEvents.some((e) => e.eventId === EVENT_ID_2)).toBe(true);
          expect(emittedStarted.some((e) => e.eventId === EVENT_ID_2)).toBe(true);
        }),
      ),
      Effect.provide(
        Layer.mergeAll(
          PartiallyFailingEventsRepo,
          MockEventSyncEventsRepositoryLayer,
          MockChannelMappingRepositoryLayer,
        ),
      ),
      Effect.asVoid,
    );
  });

  it.effect('emits member_group_id in emitEventStarted', () => {
    eventsToStart = [
      {
        id: EVENT_ID_1,
        team_id: TEAM_ID,
        title: 'Group Match',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.none(),
        location: Option.none(),
        event_type: 'match',
        member_group_id: Option.some(GROUP_ID_A),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
      },
    ];

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(emittedStarted).toHaveLength(1);
          expect(Option.isSome(emittedStarted[0].memberGroupId)).toBe(true);
          if (Option.isSome(emittedStarted[0].memberGroupId)) {
            expect(emittedStarted[0].memberGroupId.value).toBe(GROUP_ID_A);
          }
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('resolves discord_role_id from channel mapping for member_group_id', () => {
    eventsToStart = [
      {
        id: EVENT_ID_1,
        team_id: TEAM_ID,
        title: 'Group Match With Role',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.none(),
        location: Option.none(),
        event_type: 'match',
        member_group_id: Option.some(GROUP_ID_A),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
      },
    ];
    channelMappings.set(`${TEAM_ID}:${GROUP_ID_A}`, {
      discord_channel_id: CHANNEL_OWNER,
      discord_role_id: Option.some(ROLE_ID),
    });

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(emittedStarted).toHaveLength(1);
          const emitted = emittedStarted[0];
          expect(Option.isSome(emitted.discordRoleId)).toBe(true);
          if (Option.isSome(emitted.discordRoleId)) {
            expect(emitted.discordRoleId.value).toBe(ROLE_ID);
          }
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('emits with None discord_role_id when no mapping exists for member_group_id', () => {
    eventsToStart = [
      {
        id: EVENT_ID_1,
        team_id: TEAM_ID,
        title: 'Group No Mapping',
        description: Option.none(),
        start_at: START_AT,
        end_at: Option.none(),
        location: Option.none(),
        event_type: 'match',
        member_group_id: Option.some(GROUP_ID_A),
        discord_target_channel_id: Option.none(),
        owner_group_id: Option.none(),
        reminders_channel_id: Option.none(),
      },
    ];
    // No mapping set in channelMappings

    return eventStartCronEffect.pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(emittedStarted).toHaveLength(1);
          expect(Option.isNone(emittedStarted[0].discordRoleId)).toBe(true);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });
});
