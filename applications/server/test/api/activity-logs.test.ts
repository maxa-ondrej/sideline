import { afterEach, beforeEach, describe, expect, it } from '@effect/vitest';
import type { ActivityLog, Auth, Role, Team, TeamMember } from '@sideline/domain';
import { ActivityLogApi } from '@sideline/domain';
import { DateTime, Effect, Either, Layer, Option } from 'effect';
import { ActivityLogsRepository } from '~/repositories/ActivityLogsRepository.js';
import type { MembershipWithRole } from '~/repositories/TeamMembersRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

// --- Test IDs ---
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as Auth.UserId;
const TEST_OTHER_USER_ID = '00000000-0000-0000-0000-000000000002' as Auth.UserId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_OTHER_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;
const TEST_LOG_ID_1 = 'log-uuid-001' as ActivityLog.ActivityLogId;
const TEST_LOG_ID_2 = 'log-uuid-002' as ActivityLog.ActivityLogId;
const TEST_NONEXISTENT_LOG_ID = 'log-uuid-999' as ActivityLog.ActivityLogId;

const PLAYER_PERMISSIONS: readonly Role.Permission[] = ['roster:view', 'member:view'];

// --- In-memory stores ---
type ActivityLogRecord = {
  id: ActivityLog.ActivityLogId;
  team_member_id: TeamMember.TeamMemberId;
  activity_type: ActivityLog.ActivityType;
  logged_at: Date;
  duration_minutes: Option.Option<number>;
  note: Option.Option<string>;
};

let activityLogsStore: Map<ActivityLog.ActivityLogId, ActivityLogRecord>;

const resetStores = () => {
  activityLogsStore = new Map();
  activityLogsStore.set(TEST_LOG_ID_1, {
    id: TEST_LOG_ID_1,
    team_member_id: TEST_MEMBER_ID,
    activity_type: 'gym',
    logged_at: new Date('2026-03-25T10:00:00Z'),
    duration_minutes: Option.some(60),
    note: Option.some('Leg day'),
  });
  activityLogsStore.set(TEST_LOG_ID_2, {
    id: TEST_LOG_ID_2,
    team_member_id: TEST_MEMBER_ID,
    activity_type: 'running',
    logged_at: new Date('2026-03-26T08:00:00Z'),
    duration_minutes: Option.none(),
    note: Option.none(),
  });
};

// --- Mock layers ---
const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  findMembershipByIds: (teamId: Team.TeamId, userId: Auth.UserId) => {
    if (teamId === TEST_TEAM_ID && userId === TEST_USER_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_MEMBER_ID,
          team_id: TEST_TEAM_ID,
          user_id: TEST_USER_ID,
          active: true,
          role_names: ['Player'],
          permissions: PLAYER_PERMISSIONS,
        } as MembershipWithRole),
      );
    if (teamId === TEST_TEAM_ID && userId === TEST_OTHER_USER_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_OTHER_MEMBER_ID,
          team_id: TEST_TEAM_ID,
          user_id: TEST_OTHER_USER_ID,
          active: true,
          role_names: ['Player'],
          permissions: PLAYER_PERMISSIONS,
        } as MembershipWithRole),
      );
    return Effect.succeed(Option.none());
  },
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

const MockInactiveMemberTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  findMembershipByIds: (teamId: Team.TeamId, userId: Auth.UserId) => {
    if (teamId === TEST_TEAM_ID && userId === TEST_USER_ID)
      return Effect.succeed(
        Option.some({
          id: TEST_MEMBER_ID,
          team_id: TEST_TEAM_ID,
          user_id: TEST_USER_ID,
          active: false,
          role_names: ['Player'],
          permissions: PLAYER_PERMISSIONS,
        } as MembershipWithRole),
      );
    return Effect.succeed(Option.none());
  },
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

const MockActivityLogsRepositoryLayer = Layer.succeed(ActivityLogsRepository, {
  findByTeamMember: (memberId: TeamMember.TeamMemberId) => {
    const logs = Array.from(activityLogsStore.values())
      .filter((l) => l.team_member_id === memberId)
      .map((l) => ({
        activity_type: l.activity_type,
        logged_at_date: l.logged_at.toISOString().slice(0, 10),
        duration_minutes: l.duration_minutes,
      }));
    return Effect.succeed(logs);
  },
  findByMember: (memberId: TeamMember.TeamMemberId) => {
    const logs = Array.from(activityLogsStore.values()).filter(
      (l) => l.team_member_id === memberId,
    );
    return Effect.succeed(logs);
  },
  findById: (id: ActivityLog.ActivityLogId, memberId: TeamMember.TeamMemberId) => {
    const log = activityLogsStore.get(id);
    const found = log && log.team_member_id === memberId ? log : undefined;
    return Effect.succeed(found ? Option.some(found) : Option.none());
  },
  insert: (input: {
    team_member_id: TeamMember.TeamMemberId;
    activity_type: ActivityLog.ActivityType;
    logged_at: Date;
    duration_minutes: Option.Option<number>;
    note: Option.Option<string>;
  }) => {
    const id = crypto.randomUUID() as ActivityLog.ActivityLogId;
    const record: ActivityLogRecord = { id, ...input };
    activityLogsStore.set(id, record);
    return Effect.succeed({
      id,
      activity_type: input.activity_type,
      logged_at: input.logged_at.toISOString(),
    });
  },
  update: (
    id: ActivityLog.ActivityLogId,
    memberId: TeamMember.TeamMemberId,
    input: {
      activity_type: Option.Option<ActivityLog.ActivityType>;
      duration_minutes: Option.Option<Option.Option<number>>;
      note: Option.Option<Option.Option<string>>;
    },
  ) => {
    const existing = activityLogsStore.get(id);
    if (!existing || existing.team_member_id !== memberId)
      return Effect.fail(new ActivityLogApi.LogNotFound());
    const updated: ActivityLogRecord = {
      ...existing,
      activity_type: Option.getOrElse(input.activity_type, () => existing.activity_type),
      duration_minutes: Option.getOrElse(input.duration_minutes, () => existing.duration_minutes),
      note: Option.getOrElse(input.note, () => existing.note),
    };
    activityLogsStore.set(id, updated);
    return Effect.succeed(updated);
  },
  delete: (id: ActivityLog.ActivityLogId, memberId: TeamMember.TeamMemberId) => {
    const existing = activityLogsStore.get(id);
    if (!existing || existing.team_member_id !== memberId)
      return Effect.fail(new ActivityLogApi.LogNotFound());
    activityLogsStore.delete(id);
    return Effect.void;
  },
} as unknown as ActivityLogsRepository);

const MockProvideLayer = Layer.mergeAll(
  MockTeamMembersRepositoryLayer,
  MockActivityLogsRepositoryLayer,
);

const MockInactiveMemberProvideLayer = Layer.mergeAll(
  MockInactiveMemberTeamMembersRepositoryLayer,
  MockActivityLogsRepositoryLayer,
);

// --- Handler logic (mirrors actual API handler) ---

const listLogs = (payload: {
  teamId: Team.TeamId;
  memberId: TeamMember.TeamMemberId;
  currentUserId: Auth.UserId;
}): Effect.Effect<
  ActivityLogApi.ActivityLogListResponse,
  ActivityLogApi.Forbidden | ActivityLogApi.MemberNotFound,
  TeamMembersRepository | ActivityLogsRepository
> =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.bind('membership', ({ members }) =>
      members.findMembershipByIds(payload.teamId, payload.currentUserId).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new ActivityLogApi.Forbidden()),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.tap(({ membership }) =>
      membership.id === payload.memberId
        ? Effect.void
        : Effect.fail(new ActivityLogApi.Forbidden()),
    ),
    Effect.bind('logs', ({ activityLogs }) => activityLogs.findByMember(payload.memberId)),
    Effect.map(
      ({ logs }) =>
        new ActivityLogApi.ActivityLogListResponse({
          logs: logs.map(
            (l) =>
              new ActivityLogApi.ActivityLogEntry({
                id: l.id,
                activityType: l.activity_type,
                loggedAt: l.logged_at.toISOString(),
                durationMinutes: l.duration_minutes,
                note: l.note,
              }),
          ),
        }),
    ),
  );

const createLog = (payload: {
  teamId: Team.TeamId;
  memberId: TeamMember.TeamMemberId;
  currentUserId: Auth.UserId;
  activityType: ActivityLog.ActivityType;
  durationMinutes: Option.Option<number>;
  note: Option.Option<string>;
}): Effect.Effect<
  ActivityLogApi.ActivityLogEntry,
  ActivityLogApi.Forbidden | ActivityLogApi.MemberNotFound | ActivityLogApi.MemberInactive,
  TeamMembersRepository | ActivityLogsRepository
> =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.bind('membership', ({ members }) =>
      members.findMembershipByIds(payload.teamId, payload.currentUserId).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new ActivityLogApi.Forbidden()),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.tap(({ membership }) =>
      membership.id === payload.memberId
        ? Effect.void
        : Effect.fail(new ActivityLogApi.Forbidden()),
    ),
    Effect.tap(({ membership }) =>
      membership.active ? Effect.void : Effect.fail(new ActivityLogApi.MemberInactive()),
    ),
    Effect.flatMap(({ activityLogs }) =>
      activityLogs.insert({
        team_member_id: payload.memberId,
        activity_type: payload.activityType,
        logged_at: DateTime.toDateUtc(DateTime.unsafeNow()),
        duration_minutes: payload.durationMinutes,
        note: payload.note,
      }),
    ),
    Effect.map(
      (inserted) =>
        new ActivityLogApi.ActivityLogEntry({
          id: inserted.id,
          activityType: inserted.activity_type,
          loggedAt: inserted.logged_at,
          durationMinutes: payload.durationMinutes,
          note: payload.note,
        }),
    ),
  );

const updateLog = (payload: {
  teamId: Team.TeamId;
  memberId: TeamMember.TeamMemberId;
  logId: ActivityLog.ActivityLogId;
  currentUserId: Auth.UserId;
  activityType: Option.Option<ActivityLog.ActivityType>;
  durationMinutes: Option.Option<Option.Option<number>>;
  note: Option.Option<Option.Option<string>>;
}): Effect.Effect<
  ActivityLogApi.ActivityLogEntry,
  ActivityLogApi.Forbidden | ActivityLogApi.LogNotFound | ActivityLogApi.MemberInactive,
  TeamMembersRepository | ActivityLogsRepository
> =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.bind('membership', ({ members }) =>
      members.findMembershipByIds(payload.teamId, payload.currentUserId).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new ActivityLogApi.Forbidden()),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.tap(({ membership }) =>
      membership.id === payload.memberId
        ? Effect.void
        : Effect.fail(new ActivityLogApi.Forbidden()),
    ),
    Effect.tap(({ membership }) =>
      membership.active ? Effect.void : Effect.fail(new ActivityLogApi.MemberInactive()),
    ),
    Effect.flatMap(({ activityLogs }) =>
      activityLogs.update(payload.logId, payload.memberId, {
        activity_type: payload.activityType,
        duration_minutes: payload.durationMinutes,
        note: payload.note,
      }),
    ),
    Effect.map(
      (updated) =>
        new ActivityLogApi.ActivityLogEntry({
          id: updated.id,
          activityType: updated.activity_type,
          loggedAt: updated.logged_at.toISOString(),
          durationMinutes: updated.duration_minutes,
          note: updated.note,
        }),
    ),
  );

const deleteLog = (payload: {
  teamId: Team.TeamId;
  memberId: TeamMember.TeamMemberId;
  logId: ActivityLog.ActivityLogId;
  currentUserId: Auth.UserId;
}): Effect.Effect<
  void,
  ActivityLogApi.Forbidden | ActivityLogApi.LogNotFound | ActivityLogApi.MemberInactive,
  TeamMembersRepository | ActivityLogsRepository
> =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('activityLogs', () => ActivityLogsRepository),
    Effect.bind('membership', ({ members }) =>
      members.findMembershipByIds(payload.teamId, payload.currentUserId).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new ActivityLogApi.Forbidden()),
            onSome: Effect.succeed,
          }),
        ),
      ),
    ),
    Effect.tap(({ membership }) =>
      membership.id === payload.memberId
        ? Effect.void
        : Effect.fail(new ActivityLogApi.Forbidden()),
    ),
    Effect.tap(({ membership }) =>
      membership.active ? Effect.void : Effect.fail(new ActivityLogApi.MemberInactive()),
    ),
    Effect.flatMap(({ activityLogs }) => activityLogs.delete(payload.logId, payload.memberId)),
  );

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  resetStores();
});

describe('listLogs handler', () => {
  it.effect('returns logs for own profile', () =>
    listLogs({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      currentUserId: TEST_USER_ID,
    }).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result.logs).toHaveLength(2);
          expect(result.logs[0].id).toBe(TEST_LOG_ID_1);
          expect(result.logs[0].activityType).toBe('gym');
          expect(Option.getOrNull(result.logs[0].durationMinutes)).toBe(60);
          expect(Option.getOrNull(result.logs[0].note)).toBe('Leg day');
          expect(result.logs[1].id).toBe(TEST_LOG_ID_2);
          expect(result.logs[1].activityType).toBe('running');
          expect(Option.isNone(result.logs[1].durationMinutes)).toBe(true);
          expect(Option.isNone(result.logs[1].note)).toBe(true);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 403 when memberId is not current user', () =>
    listLogs({
      teamId: TEST_TEAM_ID,
      memberId: TEST_OTHER_MEMBER_ID,
      currentUserId: TEST_USER_ID,
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogForbidden');
          }
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );
});

describe('createLog handler', () => {
  it.effect('succeeds for active own profile', () =>
    createLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      currentUserId: TEST_USER_ID,
      activityType: 'gym',
      durationMinutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result.activityType).toBe('gym');
          expect(Option.isNone(result.durationMinutes)).toBe(true);
          expect(Option.isNone(result.note)).toBe(true);
          expect(activityLogsStore.size).toBe(3);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 403 for other member profile', () =>
    createLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_OTHER_MEMBER_ID,
      currentUserId: TEST_USER_ID,
      activityType: 'running',
      durationMinutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogForbidden');
          }
          expect(activityLogsStore.size).toBe(2);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 403 for inactive member', () =>
    createLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      currentUserId: TEST_USER_ID,
      activityType: 'gym',
      durationMinutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogMemberInactive');
          }
          expect(activityLogsStore.size).toBe(2);
        }),
      ),
      Effect.provide(MockInactiveMemberProvideLayer),
      Effect.asVoid,
    ),
  );
});

describe('updateLog handler', () => {
  it.effect('succeeds with partial fields (only activityType)', () =>
    updateLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      logId: TEST_LOG_ID_1,
      currentUserId: TEST_USER_ID,
      activityType: Option.some('running' as ActivityLog.ActivityType),
      durationMinutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(result.id).toBe(TEST_LOG_ID_1);
          expect(result.activityType).toBe('running');
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 404 for non-existent log', () =>
    updateLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      logId: TEST_NONEXISTENT_LOG_ID,
      currentUserId: TEST_USER_ID,
      activityType: Option.some('gym' as ActivityLog.ActivityType),
      durationMinutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogNotFound');
          }
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 403 when updating log for another member', () =>
    updateLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_OTHER_MEMBER_ID,
      logId: TEST_LOG_ID_1,
      currentUserId: TEST_USER_ID,
      activityType: Option.some('gym' as ActivityLog.ActivityType),
      durationMinutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogForbidden');
          }
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 403 for inactive member on update', () =>
    updateLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      logId: TEST_LOG_ID_1,
      currentUserId: TEST_USER_ID,
      activityType: Option.some('gym' as ActivityLog.ActivityType),
      durationMinutes: Option.none(),
      note: Option.none(),
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogMemberInactive');
          }
        }),
      ),
      Effect.provide(MockInactiveMemberProvideLayer),
      Effect.asVoid,
    ),
  );
});

describe('deleteLog handler', () => {
  it.effect('succeeds for own log', () =>
    deleteLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      logId: TEST_LOG_ID_1,
      currentUserId: TEST_USER_ID,
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(activityLogsStore.has(TEST_LOG_ID_1)).toBe(false);
          expect(activityLogsStore.size).toBe(1);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 404 for non-existent log', () =>
    deleteLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      logId: TEST_NONEXISTENT_LOG_ID,
      currentUserId: TEST_USER_ID,
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogNotFound');
          }
          expect(activityLogsStore.size).toBe(2);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 403 when deleting log for another member', () =>
    deleteLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_OTHER_MEMBER_ID,
      logId: TEST_LOG_ID_1,
      currentUserId: TEST_USER_ID,
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogForbidden');
          }
          expect(activityLogsStore.size).toBe(2);
        }),
      ),
      Effect.provide(MockProvideLayer),
      Effect.asVoid,
    ),
  );

  it.effect('returns 403 for inactive member on delete', () =>
    deleteLog({
      teamId: TEST_TEAM_ID,
      memberId: TEST_MEMBER_ID,
      logId: TEST_LOG_ID_1,
      currentUserId: TEST_USER_ID,
    }).pipe(
      Effect.either,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Either.isLeft(result)).toBe(true);
          if (Either.isLeft(result)) {
            expect(result.left._tag).toBe('ActivityLogMemberInactive');
          }
          expect(activityLogsStore.size).toBe(2);
        }),
      ),
      Effect.provide(MockInactiveMemberProvideLayer),
      Effect.asVoid,
    ),
  );
});
