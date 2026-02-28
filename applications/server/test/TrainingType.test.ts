import { HttpApiBuilder, HttpClient, HttpClientResponse, HttpServer } from '@effect/platform';
import type {
  Auth,
  Role,
  Team,
  TeamMember,
  TrainingType as TrainingTypeNS,
} from '@sideline/domain';
import { OAuth2Tokens } from 'arctic';
import { DateTime, Effect, Layer, Option } from 'effect';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiLive } from '~/api/index.js';
import { AuthMiddlewareLive } from '~/middleware/AuthMiddlewareLive.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { ChannelSyncEventsRepository } from '~/repositories/ChannelSyncEventsRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { RostersRepository } from '~/repositories/RostersRepository.js';
import { SessionsRepository } from '~/repositories/SessionsRepository.js';
import { SubgroupsRepository } from '~/repositories/SubgroupsRepository.js';
import { TeamInvitesRepository } from '~/repositories/TeamInvitesRepository.js';
import type { MembershipWithRole } from '~/repositories/TeamMembersRepository.js';
import { RosterEntry, TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';
import { DiscordOAuth } from '~/services/DiscordOAuth.js';

// --- Test IDs ---
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001' as Auth.UserId;
const TEST_ADMIN_ID = '00000000-0000-0000-0000-000000000002' as Auth.UserId;
const TEST_COACH_ID = '00000000-0000-0000-0000-000000000003' as Auth.UserId;
const TEST_TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const TEST_MEMBER_ID = '00000000-0000-0000-0000-000000000020' as TeamMember.TeamMemberId;
const TEST_ADMIN_MEMBER_ID = '00000000-0000-0000-0000-000000000021' as TeamMember.TeamMemberId;
const TEST_COACH_MEMBER_ID = '00000000-0000-0000-0000-000000000022' as TeamMember.TeamMemberId;
const TEST_PLAYER_ROLE_ID = '00000000-0000-0000-0000-000000000041' as Role.RoleId;
const TEST_TT_ASSIGNED = '00000000-0000-0000-0000-000000000050' as TrainingTypeNS.TrainingTypeId;
const TEST_TT_UNASSIGNED = '00000000-0000-0000-0000-000000000051' as TrainingTypeNS.TrainingTypeId;

const ADMIN_PERMISSIONS =
  'team:manage,team:invite,roster:view,roster:manage,member:view,member:edit,member:remove,role:view,role:manage';
const PLAYER_PERMISSIONS = 'roster:view,member:view';

// --- Users ---
const testUser = {
  id: TEST_USER_ID,
  discord_id: '12345',
  discord_username: 'testuser',
  discord_avatar: null,
  discord_access_token: 'token',
  discord_refresh_token: null,
  is_profile_complete: false,
  name: null,
  birth_year: null,
  gender: null,
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testAdmin = {
  id: TEST_ADMIN_ID,
  discord_id: '67890',
  discord_username: 'adminuser',
  discord_avatar: null,
  discord_access_token: 'admin-token',
  discord_refresh_token: null,
  is_profile_complete: true,
  name: 'Admin User',
  birth_year: 1990,
  gender: 'male' as const,
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testCoach = {
  id: TEST_COACH_ID,
  discord_id: '11111',
  discord_username: 'coachuser',
  discord_avatar: null,
  discord_access_token: 'coach-token',
  discord_refresh_token: null,
  is_profile_complete: true,
  name: 'Coach User',
  birth_year: 1985,
  gender: 'male' as const,
  locale: 'en' as const,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

const testTeam = {
  id: TEST_TEAM_ID,
  name: 'Test Team',
  created_by: TEST_ADMIN_ID,
  created_at: DateTime.unsafeNow(),
  updated_at: DateTime.unsafeNow(),
};

type UserLike = {
  id: Auth.UserId;
  discord_id: string;
  discord_username: string;
  discord_avatar: string | null;
  discord_access_token: string;
  discord_refresh_token: string | null;
  is_profile_complete: boolean;
  name: string | null;
  birth_year: number | null;
  gender: 'male' | 'female' | 'other' | null;
  locale: 'en' | 'cs';
  created_at: DateTime.Utc;
  updated_at: DateTime.Utc;
};

// --- Stores ---
const usersMap = new Map<Auth.UserId, UserLike>();
usersMap.set(TEST_USER_ID, testUser);
usersMap.set(TEST_ADMIN_ID, testAdmin);
usersMap.set(TEST_COACH_ID, testCoach);

const sessionsStore = new Map<string, Auth.UserId>();
sessionsStore.set('user-token', TEST_USER_ID);
sessionsStore.set('admin-token', TEST_ADMIN_ID);
sessionsStore.set('coach-token', TEST_COACH_ID);

const membersStore = new Map<string, MembershipWithRole>();
membersStore.set(TEST_MEMBER_ID, {
  id: TEST_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_USER_ID,
  active: true,
  role_names: 'Player',
  permissions: PLAYER_PERMISSIONS,
});
membersStore.set(TEST_ADMIN_MEMBER_ID, {
  id: TEST_ADMIN_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_ADMIN_ID,
  active: true,
  role_names: 'Admin',
  permissions: ADMIN_PERMISSIONS,
});
membersStore.set(TEST_COACH_MEMBER_ID, {
  id: TEST_COACH_MEMBER_ID,
  team_id: TEST_TEAM_ID,
  user_id: TEST_COACH_ID,
  active: true,
  role_names: 'Player',
  permissions: PLAYER_PERMISSIONS,
});

// --- In-memory training types ---
type TrainingTypeRecord = {
  id: TrainingTypeNS.TrainingTypeId;
  team_id: Team.TeamId;
  name: string;
  created_at: Date;
};

let trainingTypesStore: Map<TrainingTypeNS.TrainingTypeId, TrainingTypeRecord>;
let coachAssignmentsStore: Set<string>; // "trainingTypeId:memberId"

const resetStores = () => {
  trainingTypesStore = new Map();
  trainingTypesStore.set(TEST_TT_ASSIGNED, {
    id: TEST_TT_ASSIGNED,
    team_id: TEST_TEAM_ID,
    name: 'Assigned Training',
    created_at: new Date(),
  });
  trainingTypesStore.set(TEST_TT_UNASSIGNED, {
    id: TEST_TT_UNASSIGNED,
    team_id: TEST_TEAM_ID,
    name: 'Unassigned Training',
    created_at: new Date(),
  });
  coachAssignmentsStore = new Set();
  coachAssignmentsStore.add(`${TEST_TT_ASSIGNED}:${TEST_COACH_MEMBER_ID}`);
};

const buildRosterEntry = (
  memberId: TeamMember.TeamMemberId,
  userId: Auth.UserId,
  roleNames: string,
  permissions: string,
): RosterEntry => {
  const user = usersMap.get(userId);
  if (!user) throw new Error(`User ${userId} not found in usersMap`);
  return new RosterEntry({
    member_id: memberId,
    user_id: userId,
    role_names: roleNames,
    permissions,
    name: user.name,
    birth_year: user.birth_year,
    gender: user.gender,
    jersey_number: null,
    discord_username: user.discord_username,
    discord_avatar: user.discord_avatar,
  });
};

// --- Mock layers ---
const MockDiscordOAuthLayer = Layer.succeed(DiscordOAuth, {
  _tag: 'api/DiscordOAuth',
  createAuthorizationURL: (_state: string) =>
    Effect.succeed(new URL('https://discord.com/oauth2/authorize?client_id=test')),
  validateAuthorizationCode: () =>
    Effect.succeed(
      new OAuth2Tokens({ access_token: 'mock-access-token', refresh_token: 'mock-refresh-token' }),
    ),
});

const MockUsersRepositoryLayer = Layer.succeed(UsersRepository, {
  _tag: 'api/UsersRepository',
  findById: (id: Auth.UserId) => {
    const user = usersMap.get(id);
    return Effect.succeed(user ? Option.some(user) : Option.none());
  },
  findByDiscordId: () => Effect.succeed(Option.none()),
  upsertFromDiscord: () => Effect.succeed(testUser),
  completeProfile: () => Effect.succeed(testUser),
  updateLocale: () => Effect.succeed(testUser),
  updateAdminProfile: () => Effect.die(new Error('Not implemented')),
});

const MockSessionsRepositoryLayer = Layer.succeed(SessionsRepository, {
  _tag: 'api/SessionsRepository',
  create: (input) => {
    sessionsStore.set(input.token, input.user_id);
    return Effect.succeed({
      id: 'session-1',
      user_id: input.user_id,
      token: input.token,
      expires_at: DateTime.unsafeNow(),
      created_at: DateTime.unsafeNow(),
    });
  },
  findByToken: (token) => {
    const userId = sessionsStore.get(token);
    if (!userId) return Effect.succeed(Option.none());
    return Effect.succeed(
      Option.some({
        id: 'session-1',
        user_id: userId,
        token,
        expires_at: DateTime.unsafeNow(),
        created_at: DateTime.unsafeNow(),
      }),
    );
  },
  deleteByToken: () => Effect.void,
});

const MockTeamsRepositoryLayer = Layer.succeed(TeamsRepository, {
  _tag: 'api/TeamsRepository',
  findById: (id: Team.TeamId) => {
    if (id === TEST_TEAM_ID) return Effect.succeed(Option.some(testTeam));
    return Effect.succeed(Option.none());
  },
  insert: () => Effect.succeed(testTeam),
});

const MockTeamMembersRepositoryLayer = Layer.succeed(TeamMembersRepository, {
  _tag: 'api/TeamMembersRepository',
  addMember: () => Effect.die(new Error('Not implemented')),
  findMembership: (input) => {
    const member = Array.from(membersStore.values()).find(
      (m) => m.team_id === input.team_id && m.user_id === input.user_id,
    );
    return Effect.succeed(member ? Option.some(member) : Option.none());
  },
  findMembershipByIds: (teamId: Team.TeamId, userId: Auth.UserId) => {
    const member = Array.from(membersStore.values()).find(
      (m) => m.team_id === teamId && m.user_id === userId,
    );
    return Effect.succeed(member ? Option.some(member) : Option.none());
  },
  findByTeam: () => Effect.succeed([]),
  findByUser: (userId) =>
    Effect.succeed(Array.from(membersStore.values()).filter((m) => m.user_id === userId)),
  findRosterByTeam: (teamId) =>
    Effect.succeed(
      Array.from(membersStore.values())
        .filter((m) => m.team_id === teamId && m.active)
        .map((m) => buildRosterEntry(m.id, m.user_id, m.role_names, m.permissions)),
    ),
  findRosterMember: () => Effect.succeed(Option.none()),
  findRosterMemberByIds: (teamId, memberId: TeamMember.TeamMemberId) => {
    const member = membersStore.get(memberId);
    if (!member || member.team_id !== teamId || !member.active) {
      return Effect.succeed(Option.none());
    }
    return Effect.succeed(
      Option.some(
        buildRosterEntry(member.id, member.user_id, member.role_names, member.permissions),
      ),
    );
  },
  deactivateMember: () => Effect.die(new Error('Not implemented')),
  deactivateMemberByIds: () => Effect.die(new Error('Not implemented')),
  findPlayerRoleId: () => Effect.succeed(Option.some({ id: TEST_PLAYER_ROLE_ID })),
  getPlayerRoleId: () => Effect.succeed(Option.some({ id: TEST_PLAYER_ROLE_ID })),
  assignRoleToMember: () => Effect.void,
  unassignRoleFromMember: () => Effect.void,
  assignRole: () => Effect.void,
  unassignRole: () => Effect.void,
  updateJerseyNumber: () => Effect.void,
  setJerseyNumber: () => Effect.void,
});

const MockRostersRepositoryLayer = Layer.succeed(RostersRepository, {
  _tag: 'api/RostersRepository',
  findByTeam: () => Effect.succeed([]),
  findByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findRosterById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  delete: () => Effect.void,
  findMemberEntries: () => Effect.succeed([]),
  findMemberEntriesById: () => Effect.succeed([]),
  addMember: () => Effect.void,
  addMemberById: () => Effect.void,
  removeMember: () => Effect.void,
  removeMemberById: () => Effect.void,
});

const MockTrainingTypesRepositoryLayer = Layer.succeed(TrainingTypesRepository, {
  _tag: 'api/TrainingTypesRepository',
  findByTeamId: (teamId: string) => {
    const results = Array.from(trainingTypesStore.values())
      .filter((t) => t.team_id === teamId)
      .map((t) => ({
        ...t,
        coach_count: Array.from(coachAssignmentsStore).filter((k) => k.startsWith(`${t.id}:`))
          .length,
      }));
    return Effect.succeed(results);
  },
  findTrainingTypesByTeamId: (teamId: string) => {
    const results = Array.from(trainingTypesStore.values())
      .filter((t) => t.team_id === teamId)
      .map((t) => ({
        ...t,
        coach_count: Array.from(coachAssignmentsStore).filter((k) => k.startsWith(`${t.id}:`))
          .length,
      }));
    return Effect.succeed(results);
  },
  findById: (id: TrainingTypeNS.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    return Effect.succeed(tt ? Option.some(tt) : Option.none());
  },
  findTrainingTypeById: (id: TrainingTypeNS.TrainingTypeId) => {
    const tt = trainingTypesStore.get(id);
    return Effect.succeed(tt ? Option.some(tt) : Option.none());
  },
  insert: (input: { team_id: string; name: string }) => {
    const id = crypto.randomUUID() as TrainingTypeNS.TrainingTypeId;
    const record: TrainingTypeRecord = {
      id,
      team_id: input.team_id as Team.TeamId,
      name: input.name,
      created_at: new Date(),
    };
    trainingTypesStore.set(id, record);
    return Effect.succeed(record);
  },
  insertTrainingType: (teamId: Team.TeamId, name: string) => {
    const id = crypto.randomUUID() as TrainingTypeNS.TrainingTypeId;
    const record: TrainingTypeRecord = {
      id,
      team_id: teamId,
      name,
      created_at: new Date(),
    };
    trainingTypesStore.set(id, record);
    return Effect.succeed(record);
  },
  update: (input: { id: TrainingTypeNS.TrainingTypeId; name: string }) => {
    const tt = trainingTypesStore.get(input.id);
    if (!tt) return Effect.die(new Error('Not found'));
    const updated = { ...tt, name: input.name };
    trainingTypesStore.set(input.id, updated);
    return Effect.succeed(updated);
  },
  updateTrainingType: (id: TrainingTypeNS.TrainingTypeId, name: string) => {
    const tt = trainingTypesStore.get(id);
    if (!tt) return Effect.die(new Error('Not found'));
    const updated = { ...tt, name };
    trainingTypesStore.set(id, updated);
    return Effect.succeed(updated);
  },
  deleteTrainingType: (id: TrainingTypeNS.TrainingTypeId) => {
    trainingTypesStore.delete(id);
    return Effect.void;
  },
  deleteTrainingTypeById: (id: TrainingTypeNS.TrainingTypeId) => {
    trainingTypesStore.delete(id);
    return Effect.void;
  },
  findCoaches: (trainingTypeId: TrainingTypeNS.TrainingTypeId) => {
    const coachMemberIds = Array.from(coachAssignmentsStore)
      .filter((k) => k.startsWith(`${trainingTypeId}:`))
      .map((k) => k.split(':')[1] as TeamMember.TeamMemberId);
    const coaches = coachMemberIds.flatMap((memberId) => {
      const member = membersStore.get(memberId);
      if (!member) return [];
      const user = usersMap.get(member.user_id);
      if (!user) return [];
      return [
        {
          member_id: memberId,
          name: user.name,
          discord_username: user.discord_username,
        },
      ];
    });
    return Effect.succeed(coaches);
  },
  findCoachesByTrainingTypeId: (trainingTypeId: TrainingTypeNS.TrainingTypeId) => {
    const coachMemberIds = Array.from(coachAssignmentsStore)
      .filter((k) => k.startsWith(`${trainingTypeId}:`))
      .map((k) => k.split(':')[1] as TeamMember.TeamMemberId);
    const coaches = coachMemberIds.flatMap((memberId) => {
      const member = membersStore.get(memberId);
      if (!member) return [];
      const user = usersMap.get(member.user_id);
      if (!user) return [];
      return [
        {
          member_id: memberId,
          name: user.name,
          discord_username: user.discord_username,
        },
      ];
    });
    return Effect.succeed(coaches);
  },
  addCoach: (input: {
    training_type_id: TrainingTypeNS.TrainingTypeId;
    team_member_id: TeamMember.TeamMemberId;
  }) => {
    coachAssignmentsStore.add(`${input.training_type_id}:${input.team_member_id}`);
    return Effect.void;
  },
  addCoachById: (
    trainingTypeId: TrainingTypeNS.TrainingTypeId,
    teamMemberId: TeamMember.TeamMemberId,
  ) => {
    coachAssignmentsStore.add(`${trainingTypeId}:${teamMemberId}`);
    return Effect.void;
  },
  removeCoach: (input: {
    training_type_id: TrainingTypeNS.TrainingTypeId;
    team_member_id: TeamMember.TeamMemberId;
  }) => {
    coachAssignmentsStore.delete(`${input.training_type_id}:${input.team_member_id}`);
    return Effect.void;
  },
  removeCoachById: (
    trainingTypeId: TrainingTypeNS.TrainingTypeId,
    teamMemberId: TeamMember.TeamMemberId,
  ) => {
    coachAssignmentsStore.delete(`${trainingTypeId}:${teamMemberId}`);
    return Effect.void;
  },
  countCoachesForTrainingType: (trainingTypeId: TrainingTypeNS.TrainingTypeId) => {
    const count = Array.from(coachAssignmentsStore).filter((k) =>
      k.startsWith(`${trainingTypeId}:`),
    ).length;
    return Effect.succeed({ count });
  },
  getCoachCount: (trainingTypeId: TrainingTypeNS.TrainingTypeId) => {
    const count = Array.from(coachAssignmentsStore).filter((k) =>
      k.startsWith(`${trainingTypeId}:`),
    ).length;
    return Effect.succeed(count);
  },
  checkCoach: (input: {
    training_type_id: TrainingTypeNS.TrainingTypeId;
    team_member_id: TeamMember.TeamMemberId;
  }) => {
    const exists = coachAssignmentsStore.has(`${input.training_type_id}:${input.team_member_id}`);
    return Effect.succeed(Option.some({ exists }));
  },
  isCoachForTrainingType: (
    trainingTypeId: TrainingTypeNS.TrainingTypeId,
    memberId: TeamMember.TeamMemberId,
  ) => {
    const exists = coachAssignmentsStore.has(`${trainingTypeId}:${memberId}`);
    return Effect.succeed(exists);
  },
  findByCoach: (input: { team_id: string; member_id: string }) => {
    const assignedIds = Array.from(coachAssignmentsStore)
      .filter((k) => k.endsWith(`:${input.member_id}`))
      .map((k) => k.split(':')[0] as TrainingTypeNS.TrainingTypeId);
    const results = assignedIds.flatMap((id) => {
      const tt = trainingTypesStore.get(id);
      if (!tt || tt.team_id !== input.team_id) return [];
      return [
        {
          ...tt,
          coach_count: Array.from(coachAssignmentsStore).filter((k) => k.startsWith(`${tt.id}:`))
            .length,
        },
      ];
    });
    return Effect.succeed(results);
  },
  findTrainingTypesByCoach: (teamId: Team.TeamId, memberId: TeamMember.TeamMemberId) => {
    const assignedIds = Array.from(coachAssignmentsStore)
      .filter((k) => k.endsWith(`:${memberId}`))
      .map((k) => k.split(':')[0] as TrainingTypeNS.TrainingTypeId);
    const results = assignedIds.flatMap((id) => {
      const tt = trainingTypesStore.get(id);
      if (!tt || tt.team_id !== teamId) return [];
      return [
        {
          ...tt,
          coach_count: Array.from(coachAssignmentsStore).filter((k) => k.startsWith(`${tt.id}:`))
            .length,
        },
      ];
    });
    return Effect.succeed(results);
  },
} as unknown as TrainingTypesRepository);

const MockTeamInvitesRepositoryLayer = Layer.succeed(TeamInvitesRepository, {
  _tag: 'api/TeamInvitesRepository',
  findByCode: () => Effect.succeed(Option.none()),
  findByTeam: () => Effect.succeed([]),
  create: () => Effect.die(new Error('Not implemented')),
  deactivateByTeam: () => Effect.void,
  deactivateByTeamExcept: () => Effect.void,
});

const MockHttpClientLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify({ id: '12345', username: 'testuser', avatar: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  ),
);

const MockRolesRepositoryLayer = Layer.succeed(RolesRepository, {
  _tag: 'api/RolesRepository',
  findByTeamId: () => Effect.succeed([]),
  findRolesByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findRoleById: () => Effect.succeed(Option.none()),
  findPermissions: () => Effect.succeed([]),
  getPermissionsForRoleId: () => Effect.succeed([]),
  insert: () => Effect.die(new Error('Not implemented')),
  insertRole: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateRole: () => Effect.die(new Error('Not implemented')),
  archiveRole: () => Effect.void,
  archiveRoleById: () => Effect.void,
  deletePermissions: () => Effect.void,
  insertPermission: () => Effect.void,
  setRolePermissions: () => Effect.void,
  initTeamRoles: () => Effect.void,
  initializeTeamRoles: () => Effect.void,
  findByTeamAndName: () => Effect.succeed(Option.none()),
  findRoleByTeamAndName: () => Effect.succeed(Option.none()),
  seedTeamRolesWithPermissions: () => Effect.succeed([]),
  countMembersForRole: () => Effect.succeed({ count: 0 }),
  getMemberCountForRole: () => Effect.succeed(0),
});

const MockSubgroupsRepositoryLayer = Layer.succeed(SubgroupsRepository, {
  _tag: 'api/SubgroupsRepository',
  findByTeamId: () => Effect.succeed([]),
  findSubgroupsByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  findSubgroupById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  insertSubgroup: () => Effect.die(new Error('Not implemented')),
  update: () => Effect.die(new Error('Not implemented')),
  updateSubgroup: () => Effect.die(new Error('Not implemented')),
  archiveSubgroup: () => Effect.void,
  archiveSubgroupById: () => Effect.void,
  findMembers: () => Effect.succeed([]),
  findMembersBySubgroupId: () => Effect.succeed([]),
  addMember: () => Effect.void,
  addMemberById: () => Effect.void,
  removeMember: () => Effect.void,
  removeMemberById: () => Effect.void,
  findPermissions: () => Effect.succeed([]),
  getPermissionsForSubgroupId: () => Effect.succeed([]),
  deletePermissions: () => Effect.void,
  insertPermission: () => Effect.void,
  setSubgroupPermissions: () => Effect.void,
  countMembersForSubgroup: () => Effect.succeed({ count: 0 }),
  getMemberCount: () => Effect.succeed(0),
});

const MockAgeThresholdRepositoryLayer = Layer.succeed(AgeThresholdRepository, {
  findByTeamId: () => Effect.succeed([]),
  findById: () => Effect.succeed(Option.none()),
  insert: () => Effect.die(new Error('Not implemented')),
  updateRule: () => Effect.die(new Error('Not implemented')),
  deleteRule: () => Effect.void,
  findAllTeamsWithRules: () => Effect.succeed([]),
  findMembersWithBirthYears: () => Effect.succeed([]),
  findRulesByTeamId: () => Effect.succeed([]),
  findRuleById: () => Effect.succeed(Option.none()),
  insertRule: () => Effect.die(new Error('Not implemented')),
  updateRuleById: () => Effect.die(new Error('Not implemented')),
  deleteRuleById: () => Effect.void,
  getAllTeamsWithRules: () => Effect.succeed([]),
  getMembersWithBirthYears: () => Effect.succeed([]),
} as unknown as AgeThresholdRepository);

const MockNotificationsRepositoryLayer = Layer.succeed(NotificationsRepository, {
  findByUserId: () => Effect.succeed([]),
  insertOne: () => Effect.die(new Error('Not implemented')),
  markOneAsRead: () => Effect.void,
  markAllRead: () => Effect.void,
  findOneById: () => Effect.succeed(Option.none()),
  findByUser: () => Effect.succeed([]),
  insert: () => Effect.die(new Error('Not implemented')),
  insertBulk: () => Effect.void,
  markAsRead: () => Effect.void,
  markAllAsRead: () => Effect.void,
  findById: () => Effect.succeed(Option.none()),
} as unknown as NotificationsRepository);

const MockAgeCheckServiceLayer = Layer.succeed(AgeCheckService, {
  evaluateTeam: () => Effect.succeed([]),
  evaluate: () => Effect.succeed([]),
} as unknown as AgeCheckService);

const MockRoleSyncEventsRepositoryLayer = Layer.succeed(RoleSyncEventsRepository, {
  emitIfGuildLinked: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as unknown as RoleSyncEventsRepository);

const MockChannelSyncEventsRepositoryLayer = Layer.succeed(ChannelSyncEventsRepository, {
  emitIfGuildLinked: () => Effect.void,
  findUnprocessed: () => Effect.succeed([]),
  markProcessed: () => Effect.void,
  markFailed: () => Effect.void,
} as unknown as ChannelSyncEventsRepository);

const TestLayer = ApiLive.pipe(
  Layer.provideMerge(AuthMiddlewareLive),
  Layer.provideMerge(HttpServer.layerContext),
  Layer.provide(MockDiscordOAuthLayer),
  Layer.provide(MockUsersRepositoryLayer),
  Layer.provide(MockSessionsRepositoryLayer),
  Layer.provide(MockTeamsRepositoryLayer),
  Layer.provide(MockTeamMembersRepositoryLayer),
  Layer.provide(MockRostersRepositoryLayer),
  Layer.provide(MockTeamInvitesRepositoryLayer),
  Layer.provide(MockRolesRepositoryLayer),
  Layer.provide(MockSubgroupsRepositoryLayer),
  Layer.provide(MockTrainingTypesRepositoryLayer),
  Layer.provide(MockHttpClientLayer),
  Layer.provide(MockAgeCheckServiceLayer),
  Layer.provide(MockAgeThresholdRepositoryLayer),
  Layer.provide(MockNotificationsRepositoryLayer),
  Layer.provide(MockRoleSyncEventsRepositoryLayer),
  Layer.provide(MockChannelSyncEventsRepositoryLayer),
);

let handler: (request: Request) => Promise<Response>;
let dispose: () => Promise<void>;

beforeAll(() => {
  const app = HttpApiBuilder.toWebHandler(TestLayer);
  handler = app.handler;
  dispose = app.dispose;
});

afterAll(async () => {
  await dispose();
});

beforeEach(() => {
  resetStores();
});

const BASE = `http://localhost/teams/${TEST_TEAM_ID}/training-types`;

describe('Training Types API', () => {
  describe('GET /teams/:teamId/training-types (list)', () => {
    it('returns 401 without auth token', async () => {
      const response = await handler(new Request(BASE));
      expect(response.status).toBe(401);
    });

    it('returns 200 with all training types + canAdmin:true for admin', async () => {
      const response = await handler(
        new Request(BASE, { headers: { Authorization: 'Bearer admin-token' } }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(true);
      expect(body.trainingTypes).toHaveLength(2);
    });

    it('returns 200 with only assigned training types + canAdmin:false for coach', async () => {
      const response = await handler(
        new Request(BASE, { headers: { Authorization: 'Bearer coach-token' } }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(false);
      expect(body.trainingTypes).toHaveLength(1);
      expect(body.trainingTypes[0].trainingTypeId).toBe(TEST_TT_ASSIGNED);
    });
  });

  describe('GET /teams/:teamId/training-types/:trainingTypeId (get)', () => {
    it('returns 200 with canAdmin:true for admin viewing any training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_UNASSIGNED}`, {
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(true);
      expect(body.trainingTypeId).toBe(TEST_TT_UNASSIGNED);
    });

    it('returns 200 for coach viewing assigned training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_ASSIGNED}`, {
          headers: { Authorization: 'Bearer coach-token' },
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.canAdmin).toBe(false);
      expect(body.trainingTypeId).toBe(TEST_TT_ASSIGNED);
    });

    it('returns 403 for coach viewing unassigned training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_UNASSIGNED}`, {
          headers: { Authorization: 'Bearer coach-token' },
        }),
      );
      expect(response.status).toBe(403);
    });

    it('returns 404 for unknown training type', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000099';
      const response = await handler(
        new Request(`${BASE}/${unknownId}`, {
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /teams/:teamId/training-types/:trainingTypeId (update)', () => {
    it('returns 200 for admin updating any training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_UNASSIGNED}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Renamed' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Renamed');
    });

    it('returns 200 for coach updating assigned training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_ASSIGNED}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer coach-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Coach Renamed' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.name).toBe('Coach Renamed');
    });

    it('returns 403 for coach updating unassigned training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_UNASSIGNED}`, {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer coach-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Fail' }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('POST /teams/:teamId/training-types (create)', () => {
    it('returns 201 for admin creating training type', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Type' }),
        }),
      );
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.name).toBe('New Type');
    });

    it('returns 403 for coach creating training type', async () => {
      const response = await handler(
        new Request(BASE, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer coach-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Should Fail' }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /teams/:teamId/training-types/:trainingTypeId (delete)', () => {
    it('returns 204 for admin deleting training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_UNASSIGNED}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);
    });

    it('returns 403 for coach deleting training type', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_ASSIGNED}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer coach-token' },
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('POST /teams/:teamId/training-types/:trainingTypeId/coaches (add coach)', () => {
    it('returns 204 for admin adding coach', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_UNASSIGNED}/coaches`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer admin-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberId: TEST_COACH_MEMBER_ID }),
        }),
      );
      expect(response.status).toBe(204);
    });

    it('returns 403 for coach adding coach', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_ASSIGNED}/coaches`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer coach-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ memberId: TEST_MEMBER_ID }),
        }),
      );
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /teams/:teamId/training-types/:trainingTypeId/coaches/:memberId (remove coach)', () => {
    it('returns 204 for admin removing coach', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_ASSIGNED}/coaches/${TEST_COACH_MEMBER_ID}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer admin-token' },
        }),
      );
      expect(response.status).toBe(204);
    });

    it('returns 403 for coach removing coach', async () => {
      const response = await handler(
        new Request(`${BASE}/${TEST_TT_ASSIGNED}/coaches/${TEST_COACH_MEMBER_ID}`, {
          method: 'DELETE',
          headers: { Authorization: 'Bearer coach-token' },
        }),
      );
      expect(response.status).toBe(403);
    });
  });
});
