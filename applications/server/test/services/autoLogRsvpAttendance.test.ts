import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { ActivityLog, TeamMember } from '@sideline/domain';
import { Effect, Layer, Option } from 'effect';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import {
  autoLogRsvpAttendance,
  removeAutoLogRsvpAttendance,
} from '~/services/AutoLogRsvpAttendance.js';

// --- Test IDs ---
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;

// --- In-memory stores ---
type InsertedLog = {
  team_member_id: TeamMember.TeamMemberId;
  activity_type: ActivityLog.ActivityType;
  logged_at: Date;
  duration_minutes: Option.Option<number>;
  note: Option.Option<string>;
  source: ActivityLog.ActivitySource;
};

let insertedLogs: InsertedLog[];
let deletedAutoTrainingLogs: Array<{ memberId: TeamMember.TeamMemberId; date: Date }>;

const resetStores = () => {
  insertedLogs = [];
  deletedAutoTrainingLogs = [];
};

// --- Mock layer ---
const MockActivityLogsRepositoryLayer = Layer.succeed(ActivityLogsRepository, {
  insert: (input: InsertedLog) => {
    insertedLogs.push(input);
    const id = crypto.randomUUID() as ActivityLog.ActivityLogId;
    return Effect.succeed({
      id,
      activity_type: input.activity_type,
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

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  resetStores();
});

describe('autoLogRsvpAttendance', () => {
  it.effect('inserts a training log with source auto for the given member', () => {
    return autoLogRsvpAttendance({
      memberId: TEST_MEMBER_ID,
      loggedAt: new Date('2026-03-27T10:00:00Z'),
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs).toHaveLength(1);
          expect(insertedLogs[0].team_member_id).toBe(TEST_MEMBER_ID);
          expect(insertedLogs[0].activity_type).toBe('training');
          expect(insertedLogs[0].source).toBe('auto');
        }),
      ),
      Effect.provide(MockActivityLogsRepositoryLayer),
      Effect.asVoid,
    );
  });

  it.effect('sets logged_at to the provided date', () => {
    const loggedAt = new Date('2026-03-27T10:00:00Z');
    return autoLogRsvpAttendance({
      memberId: TEST_MEMBER_ID,
      loggedAt,
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(insertedLogs[0].logged_at).toBe(loggedAt);
        }),
      ),
      Effect.provide(MockActivityLogsRepositoryLayer),
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
