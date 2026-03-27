import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { ActivityType, TeamMember } from '@sideline/domain';
import { Effect, Layer, Option } from 'effect';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import { ActivityTypesRepository } from '~/repositories/ActivityTypesRepository.js';
import {
  autoLogRsvpAttendance,
  removeAutoLogRsvpAttendance,
} from '~/services/AutoLogRsvpAttendance.js';

// --- Test IDs ---
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TRAINING_TYPE_ID = 'type-uuid-training' as ActivityType.ActivityTypeId;

// --- In-memory stores ---
type InsertedLog = {
  team_member_id: TeamMember.TeamMemberId;
  activity_type_id: ActivityType.ActivityTypeId;
  logged_at: Date;
  duration_minutes: Option.Option<number>;
  note: Option.Option<string>;
  source: string;
};

let insertedLogs: InsertedLog[];
let deletedAutoTrainingLogs: Array<{ memberId: TeamMember.TeamMemberId; date: Date }>;

const resetStores = () => {
  insertedLogs = [];
  deletedAutoTrainingLogs = [];
};

// --- Mock layers ---
const MockActivityLogsRepositoryLayer = Layer.succeed(ActivityLogsRepository, {
  insert: (input: InsertedLog) => {
    insertedLogs.push(input);
    const id = crypto.randomUUID();
    return Effect.succeed({
      id,
      activity_type_id: input.activity_type_id,
      logged_at: input.logged_at.toISOString(),
      source: input.source,
    });
  },
  deleteAutoTrainingLog: (memberId: TeamMember.TeamMemberId, date: Date) => {
    deletedAutoTrainingLogs.push({ memberId, date });
    return Effect.void;
  },
  findByTeamMember: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
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
  MockActivityLogsRepositoryLayer,
  MockActivityTypesRepositoryLayer,
);

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  resetStores();
});

describe('autoLogRsvpAttendance', () => {
  it.effect('inserts a training log with source auto for training event type', () => {
    return autoLogRsvpAttendance({
      memberId: TEST_MEMBER_ID,
      loggedAt: new Date('2026-03-27T10:00:00Z'),
      eventType: 'training',
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs).toHaveLength(1);
          expect(insertedLogs[0].team_member_id).toBe(TEST_MEMBER_ID);
          expect(insertedLogs[0].activity_type_id).toBe(TRAINING_TYPE_ID);
          expect(insertedLogs[0].source).toBe('auto');
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('sets logged_at to the provided date', () => {
    const loggedAt = new Date('2026-03-27T10:00:00Z');
    return autoLogRsvpAttendance({
      memberId: TEST_MEMBER_ID,
      loggedAt,
      eventType: 'training',
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs[0].logged_at).toBe(loggedAt);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });

  it.effect('does nothing for non-training event types', () => {
    return autoLogRsvpAttendance({
      memberId: TEST_MEMBER_ID,
      loggedAt: new Date('2026-03-27T10:00:00Z'),
      eventType: 'match',
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs).toHaveLength(0);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    );
  });
});

describe('removeAutoLogRsvpAttendance', () => {
  it.effect('calls deleteAutoTrainingLog with the given member and date', () => {
    const loggedAt = new Date('2026-03-27T10:00:00Z');
    return removeAutoLogRsvpAttendance({
      memberId: TEST_MEMBER_ID,
      loggedAt,
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(deletedAutoTrainingLogs).toHaveLength(1);
          expect(deletedAutoTrainingLogs[0].memberId).toBe(TEST_MEMBER_ID);
          expect(deletedAutoTrainingLogs[0].date).toBe(loggedAt);
        }),
      ),
      Effect.provide(MockActivityLogsRepositoryLayer),
      Effect.asVoid,
    );
  });
});
