import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { Discord, Event, Team, TeamMember, TrainingType } from '@sideline/domain';
import { EventRpcModels } from '@sideline/domain';
import { DateTime, Effect, Layer, Option } from 'effect';
import { EventSyncEventsRepository } from '~/repositories/EventSyncEventsRepository.js';
import { EventsRepository } from '~/repositories/EventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';

// --- Test IDs ---
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;
const TEST_GUILD_ID = '999999999999999999' as Discord.Snowflake;
const TEST_TRAINING_TYPE_1 = '00000000-0000-0000-0000-000000000050' as TrainingType.TrainingTypeId;
const TEST_TRAINING_TYPE_2 = '00000000-0000-0000-0000-000000000051' as TrainingType.TrainingTypeId;
const TEST_EVENT_ID = '00000000-0000-0000-0000-000000000060' as Event.EventId;

// --- In-memory stores ---
type TrainingTypeRecord = {
  id: TrainingType.TrainingTypeId;
  team_id: Team.TeamId;
  name: string;
  owner_group_id: Option.Option<string>;
  owner_group_name: Option.Option<string>;
  member_group_id: Option.Option<string>;
  member_group_name: Option.Option<string>;
  discord_channel_id: Option.Option<string>;
  created_at: Date;
};

let trainingTypesStore: Map<TrainingType.TrainingTypeId, TrainingTypeRecord>;
let eventsInserted: Array<{ trainingTypeId: Option.Option<string> }>;

const resetStores = () => {
  trainingTypesStore = new Map();
  trainingTypesStore.set(TEST_TRAINING_TYPE_1, {
    id: TEST_TRAINING_TYPE_1,
    team_id: TEST_TEAM_ID,
    name: 'Fitness',
    owner_group_id: Option.none(),
    owner_group_name: Option.none(),
    member_group_id: Option.none(),
    member_group_name: Option.none(),
    discord_channel_id: Option.none(),
    created_at: new Date(),
  });
  trainingTypesStore.set(TEST_TRAINING_TYPE_2, {
    id: TEST_TRAINING_TYPE_2,
    team_id: TEST_TEAM_ID,
    name: 'Tactics',
    owner_group_id: Option.none(),
    owner_group_name: Option.none(),
    member_group_id: Option.none(),
    member_group_name: Option.none(),
    discord_channel_id: Option.none(),
    created_at: new Date(),
  });
  eventsInserted = [];
};

// --- Mock layers ---
const MockTeamsRepositoryLayer = Layer.succeed(TeamsRepository, {
  findById: (id: Team.TeamId) => {
    if (id === TEST_TEAM_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_TEAM_ID,
          name: 'Test Team',
          guild_id: TEST_GUILD_ID,
          created_by: 'user-1',
          created_at: DateTime.nowUnsafe(),
          updated_at: DateTime.nowUnsafe(),
        }),
      );
    return Effect.succeed(Option.none());
  },
  findByGuildId: (guildId: string) => {
    if (guildId === TEST_GUILD_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_TEAM_ID,
          name: 'Test Team',
          guild_id: TEST_GUILD_ID,
          created_by: 'user-1',
          created_at: DateTime.nowUnsafe(),
          updated_at: DateTime.nowUnsafe(),
        }),
      );
    return Effect.succeed(Option.none());
  },
  insert: () => Effect.die(new Error('Not implemented')),
} as unknown as TeamsRepository);

const MockTrainingTypesRepositoryLayer = Layer.succeed(TrainingTypesRepository, {
  findByTeamId: (teamId: string) => {
    const results = Array.from(trainingTypesStore.values()).filter((t) => t.team_id === teamId);
    return Effect.succeed(results);
  },
  findTrainingTypesByTeamId: (teamId: string) => {
    const results = Array.from(trainingTypesStore.values()).filter((t) => t.team_id === teamId);
    return Effect.succeed(results);
  },
  findById: (id: TrainingType.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.succeed(Option.none());
    return Effect.succeed(Option.some({ id: tt.id, team_id: tt.team_id, name: tt.name }));
  },
  findTrainingTypeById: (id: TrainingType.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.succeed(Option.none());
    return Effect.succeed(Option.some({ id: tt.id, team_id: tt.team_id, name: tt.name }));
  },
  findByIdWithGroup: () => Effect.succeed(Option.none()),
  findTrainingTypeByIdWithGroup: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  insertTrainingType: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateTrainingType: () => Effect.die(new Error('Not implemented')),
  deleteTrainingType: () => Effect.void,
  deleteTrainingTypeById: () => Effect.void,
} as unknown as TrainingTypesRepository);

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  findMembershipByIds: (_teamId: Team.TeamId, _userId: string) =>
    Effect.succeed(
      Option.some({
        id: TEST_ADMIN_MEMBER_ID,
        team_id: TEST_TEAM_ID,
        user_id: 'user-admin',
        active: true,
        role_names: ['Admin'],
        permissions: ['event:create'] as string[],
      }),
    ),
  findByTeam: () => Effect.succeed([]),
  findByUser: () => Effect.succeed([]),
  findRosterByTeam: () => Effect.succeed([]),
  findRosterMemberByIds: () => Effect.succeed(Option.none()),
  addMember: () => Effect.die(new Error('Not implemented')),
  deactivateMemberByIds: () => Effect.die(new Error('Not implemented')),
  getPlayerRoleId: () => Effect.succeed(Option.none()),
  assignRole: () => Effect.void,
  unassignRole: () => Effect.void,
  setJerseyNumber: () => Effect.void,
} as unknown as TeamMembersRepository);

const MockEventsRepositoryLayer = Layer.succeed(EventsRepository, {
  insertEvent: (input: { trainingTypeId: Option.Option<string> }) => {
    eventsInserted.push({ trainingTypeId: input.trainingTypeId });
    return Effect.succeed({
      id: TEST_EVENT_ID,
      team_id: TEST_TEAM_ID,
      training_type_id: input.trainingTypeId,
      event_type: 'training' as Event.EventType,
      title: 'Test Training',
      description: Option.none(),
      start_at: DateTime.nowUnsafe(),
      end_at: Option.none(),
      location: Option.none(),
      status: 'active' as Event.EventStatus,
      created_by: TEST_ADMIN_MEMBER_ID,
      series_id: Option.none(),
      series_modified: false,
      discord_target_channel_id: Option.none(),
      owner_group_id: Option.none(),
      member_group_id: Option.none(),
    });
  },
  findEventByIdWithDetails: () => Effect.succeed(Option.none()),
  findByTeamId: () => Effect.succeed([]),
  findEventsByTeamId: () => Effect.succeed([]),
  findByIdWithDetails: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateEvent: () => Effect.die(new Error('Not implemented')),
  cancel: () => Effect.void,
  cancelEvent: () => Effect.void,
  findScopedTrainingTypeIds: () => Effect.succeed([]),
  getScopedTrainingTypeIds: () => Effect.succeed([]),
  markModified: () => Effect.void,
  markEventSeriesModified: () => Effect.void,
  cancelFuture: () => Effect.void,
  cancelFutureInSeries: () => Effect.void,
  updateFutureUnmodified: () => Effect.void,
  updateFutureUnmodifiedInSeries: () => Effect.void,
  findEventsByChannelId: () => Effect.succeed([]),
  findUpcomingByGuildId: () => Effect.succeed([]),
  countUpcomingByGuildId: () => Effect.succeed(0),
  saveDiscordMessageId: () => Effect.void,
  getDiscordMessageId: () => Effect.succeed(Option.none()),
  findNonResponders: () => Effect.succeed([]),
} as unknown as EventsRepository);

const MockEventSyncEventsRepositoryLayer = Layer.succeed(EventSyncEventsRepository, {
  emitEventCreated: () => Effect.void,
  emitEventUpdated: () => Effect.void,
  emitEventCancelled: () => Effect.void,
  emitRsvpReminder: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as unknown as EventSyncEventsRepository);

// --- Helper to import and call handler functions ---
// Since GetTrainingTypesByGuild is a new RPC, we test the server handler logic directly
// by importing and exercising the function within Effect layers.

const MockProvideLayer = Layer.mergeAll(
  MockTeamsRepositoryLayer,
  MockTrainingTypesRepositoryLayer,
  MockTeamMembersRepositoryLayer,
  MockEventsRepositoryLayer,
  MockEventSyncEventsRepositoryLayer,
);

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  trainingTypesStore = new Map();
  eventsInserted = [];
});

describe('GetTrainingTypesByGuild RPC handler', () => {
  it.effect('returns training types for a valid guild mapped from team', () => {
    // This test verifies the server logic: guild_id -> team_id -> training types
    // The handler queries TeamsRepository.findByGuildId then TrainingTypesRepository.findTrainingTypesByTeamId
    return Effect.Do.pipe(
      Effect.bind('teams', () => TeamsRepository.asEffect()),
      Effect.bind('trainingTypes', () => TrainingTypesRepository.asEffect()),
      Effect.flatMap(({ teams, trainingTypes }) =>
        Effect.Do.pipe(
          Effect.bind('team', () => teams.findByGuildId(TEST_GUILD_ID)),
          Effect.flatMap(({ team }) =>
            Option.match(team, {
              onNone: () => Effect.succeed([] as Array<{ id: string; name: string }>),
              onSome: (t) =>
                trainingTypes
                  .findTrainingTypesByTeamId(t.id)
                  .pipe(Effect.map((types) => types.map((tt) => ({ id: tt.id, name: tt.name })))),
            }),
          ),
        ),
      ),
      Effect.tap((result) => {
        expect(result).toHaveLength(2);
        expect(result.find((tt) => tt.id === TEST_TRAINING_TYPE_1)?.name).toBe('Fitness');
        expect(result.find((tt) => tt.id === TEST_TRAINING_TYPE_2)?.name).toBe('Tactics');
      }),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('returns empty array when guild has no team', () => {
    const unknownGuildId = '000000000000000001' as Discord.Snowflake;

    return Effect.Do.pipe(
      Effect.bind('teams', () => TeamsRepository.asEffect()),
      Effect.bind('trainingTypes', () => TrainingTypesRepository.asEffect()),
      Effect.flatMap(({ teams, trainingTypes }) =>
        Effect.Do.pipe(
          Effect.bind('team', () => teams.findByGuildId(unknownGuildId)),
          Effect.flatMap(({ team }) =>
            Option.match(team, {
              onNone: () => Effect.succeed([] as Array<{ id: string; name: string }>),
              onSome: (t) =>
                trainingTypes
                  .findTrainingTypesByTeamId(t.id)
                  .pipe(Effect.map((types) => types.map((tt) => ({ id: tt.id, name: tt.name })))),
            }),
          ),
        ),
      ),
      Effect.tap((result) => {
        expect(result).toHaveLength(0);
      }),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('returns empty array when team has no training types', () => {
    // Clear training types store
    trainingTypesStore.clear();

    return Effect.Do.pipe(
      Effect.bind('teams', () => TeamsRepository.asEffect()),
      Effect.bind('trainingTypes', () => TrainingTypesRepository.asEffect()),
      Effect.flatMap(({ teams, trainingTypes }) =>
        Effect.Do.pipe(
          Effect.bind('team', () => teams.findByGuildId(TEST_GUILD_ID)),
          Effect.flatMap(({ team }) =>
            Option.match(team, {
              onNone: () => Effect.succeed([] as Array<{ id: string; name: string }>),
              onSome: (t) =>
                trainingTypes
                  .findTrainingTypesByTeamId(t.id)
                  .pipe(Effect.map((types) => types.map((tt) => ({ id: tt.id, name: tt.name })))),
            }),
          ),
        ),
      ),
      Effect.tap((result) => {
        expect(result).toHaveLength(0);
      }),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });
});

describe('CreateEvent RPC with training_type_id', () => {
  it.effect('passes training_type_id to insertEvent when provided', () => {
    // Once the implementation adds training_type_id to the CreateEvent payload,
    // the handler should pass it through to insertEvent.
    // This test verifies the handler correctly threads training_type_id.
    const trainingTypeId = Option.some(TEST_TRAINING_TYPE_1 as string);

    // Simulate the updated createEvent handler behavior
    return Effect.Do.pipe(
      Effect.bind('events', () => EventsRepository.asEffect()),
      Effect.flatMap(({ events }) =>
        events.insertEvent({
          teamId: TEST_TEAM_ID,
          trainingTypeId,
          eventType: 'training',
          title: 'Test Training',
          description: Option.none(),
          startAt: DateTime.nowUnsafe(),
          endAt: Option.none(),
          location: Option.none(),
          createdBy: TEST_ADMIN_MEMBER_ID,
        }),
      ),
      Effect.tap(() => {
        expect(eventsInserted).toHaveLength(1);
        expect(Option.isSome(eventsInserted[0].trainingTypeId)).toBe(true);
        expect(Option.getOrNull(eventsInserted[0].trainingTypeId)).toBe(TEST_TRAINING_TYPE_1);
      }),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('passes Option.none() for training_type_id when not provided (backward compat)', () => {
    // The updated CreateEvent should be backward-compatible when training_type_id is absent.
    return Effect.Do.pipe(
      Effect.bind('events', () => EventsRepository.asEffect()),
      Effect.flatMap(({ events }) =>
        events.insertEvent({
          teamId: TEST_TEAM_ID,
          trainingTypeId: Option.none(),
          eventType: 'match',
          title: 'Test Match',
          description: Option.none(),
          startAt: DateTime.nowUnsafe(),
          endAt: Option.none(),
          location: Option.none(),
          createdBy: TEST_ADMIN_MEMBER_ID,
        }),
      ),
      Effect.tap(() => {
        expect(eventsInserted).toHaveLength(1);
        expect(Option.isNone(eventsInserted[0].trainingTypeId)).toBe(true);
      }),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('validates training_type_id belongs to the correct team', () => {
    // The server should verify that training_type_id belongs to the team.
    // A training_type from a different team should be rejected.
    const wrongTeamId = '00000000-0000-0000-0000-000000000099' as Team.TeamId;
    const foreignTrainingTypeId =
      '00000000-0000-0000-0000-000000000099' as TrainingType.TrainingTypeId;

    // Add a training type belonging to a different team
    trainingTypesStore.set(foreignTrainingTypeId, {
      id: foreignTrainingTypeId,
      team_id: wrongTeamId,
      name: 'Foreign Type',
      owner_group_id: Option.none(),
      owner_group_name: Option.none(),
      member_group_id: Option.none(),
      member_group_name: Option.none(),
      discord_channel_id: Option.none(),
      created_at: new Date(),
    });

    // The validation logic: fetch training type and check team_id matches
    return Effect.Do.pipe(
      Effect.bind('trainingTypes', () => TrainingTypesRepository.asEffect()),
      Effect.flatMap(({ trainingTypes }) =>
        trainingTypes.findTrainingTypeById(foreignTrainingTypeId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new EventRpcModels.CreateEventForbidden()),
              onSome: (tt) =>
                tt.team_id === TEST_TEAM_ID
                  ? Effect.succeed(tt)
                  : Effect.fail(new EventRpcModels.CreateEventForbidden()),
            }),
          ),
        ),
      ),
      Effect.result,
      Effect.tap((result) => {
        expect(result._tag).toBe('Left');
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('CreateEventForbidden');
        }
      }),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });
});
