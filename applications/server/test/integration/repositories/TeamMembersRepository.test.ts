// TDD mode — tests written BEFORE the "Handle removing user" fix is implemented.
// These tests WILL FAIL until the developer implements:
//   1. `findMembershipByIds(teamId, userId, options?: { includeInactive?: boolean })`
//      — adds AND tm.active = true by default; bypasses that filter when includeInactive === true
//   2. `findByUserQuery` — adds AND tm.active = true
//
// When all tests are green, the production code is complete.

import { describe, expect, it } from '@effect/vitest';
import type { Discord, Team, User } from '@sideline/domain';
import { Effect, Layer, Option } from 'effect';
import { beforeEach } from 'vitest';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TeamsRepository } from '~/repositories/TeamsRepository.js';
import { UsersRepository } from '~/repositories/UsersRepository.js';
import { cleanDatabase, TestPgClient } from '../helpers.js';

const TestLayer = Layer.mergeAll(
  TeamMembersRepository.Default,
  TeamsRepository.Default,
  UsersRepository.Default,
).pipe(Layer.provideMerge(TestPgClient));

beforeEach(() => cleanDatabase.pipe(Effect.provide(TestPgClient), Effect.runPromise));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createUser = (discordId: string, username: string) =>
  UsersRepository.asEffect().pipe(
    Effect.andThen((repo) =>
      repo.upsertFromDiscord({
        discord_id: discordId,
        username,
        avatar: Option.none(),
        discord_nickname: Option.none(),
        discord_display_name: Option.none(),
      }),
    ),
    Effect.map((u) => u.id),
  );

const createTeam = (guildId: Discord.Snowflake, createdBy: User.UserId) =>
  TeamsRepository.asEffect().pipe(
    Effect.andThen((repo) =>
      repo.insert({
        name: 'Members Test Team',
        guild_id: guildId,
        created_by: createdBy,
        description: Option.none(),
        sport: Option.none(),
        logo_url: Option.none(),
        created_at: undefined,
        updated_at: undefined,
        welcome_channel_id: Option.none(),
        system_log_channel_id: Option.none(),
        welcome_message_template: Option.none(),
        rules_channel_id: Option.none(),
        overview_channel_id: Option.none(),
        achievement_channel_id: Option.none(),
        onboarding_rules_role_id: Option.none(),
        onboarding_rules_prompt_id: Option.none(),
        onboarding_locale: 'en',
        onboarding_synced_at: Option.none(),
        onboarding_sync_status: 'pending',
        onboarding_sync_error: Option.none(),
      }),
    ),
  );

const addActiveMember = (teamId: Team.TeamId, userId: User.UserId) =>
  TeamMembersRepository.asEffect().pipe(
    Effect.andThen((repo) =>
      repo.addMember({
        team_id: teamId,
        user_id: userId,
        active: true,
        joined_at: undefined,
      }),
    ),
  );

const deactivateMember = (teamId: Team.TeamId, memberId: string) =>
  TeamMembersRepository.asEffect().pipe(
    Effect.andThen((repo) =>
      repo.deactivateMemberByIds(
        teamId,
        memberId as import('@sideline/domain').TeamMember.TeamMemberId,
      ),
    ),
  );

// ---------------------------------------------------------------------------
// findMembershipByIds — default behaviour (active-only)
// ---------------------------------------------------------------------------

describe('TeamMembersRepository — findMembershipByIds', () => {
  it.effect('returns Some for an active membership row', () =>
    Effect.Do.pipe(
      Effect.bind('userId', () => createUser('800000000000000001', 'mbr-active-1')),
      Effect.bind('team', ({ userId }) =>
        createTeam('800100000000000000' as Discord.Snowflake, userId),
      ),
      Effect.bind('member', ({ team, userId }) => addActiveMember(team.id, userId)),
      Effect.bind('result', ({ team, userId }) =>
        TeamMembersRepository.asEffect().pipe(
          Effect.andThen((repo) => repo.findMembershipByIds(team.id, userId)),
        ),
      ),
      Effect.tap(({ result }) =>
        Effect.sync(() => {
          expect(Option.isSome(result)).toBe(true);
          const m = Option.getOrThrow(result);
          expect(m.active).toBe(true);
        }),
      ),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('returns None for an inactive membership row (default active-only filter)', () =>
    Effect.Do.pipe(
      Effect.bind('userId', () => createUser('800000000000000002', 'mbr-inactive-1')),
      Effect.bind('team', ({ userId }) =>
        createTeam('800200000000000000' as Discord.Snowflake, userId),
      ),
      Effect.bind('member', ({ team, userId }) => addActiveMember(team.id, userId)),
      // Deactivate the membership
      Effect.tap(({ team, member }) => deactivateMember(team.id, (member as any).id)),
      Effect.bind('result', ({ team, userId }) =>
        TeamMembersRepository.asEffect().pipe(
          Effect.andThen((repo) => repo.findMembershipByIds(team.id, userId)),
        ),
      ),
      Effect.tap(({ result }) =>
        Effect.sync(() => {
          // Default behaviour: inactive membership MUST be invisible
          expect(Option.isNone(result)).toBe(true);
        }),
      ),
      Effect.provide(TestLayer),
    ),
  );

  it.effect(
    'with { includeInactive: true } returns Some with active===false for deactivated member',
    () =>
      Effect.Do.pipe(
        Effect.bind('userId', () => createUser('800000000000000003', 'mbr-inactive-2')),
        Effect.bind('team', ({ userId }) =>
          createTeam('800300000000000000' as Discord.Snowflake, userId),
        ),
        Effect.bind('member', ({ team, userId }) => addActiveMember(team.id, userId)),
        // Deactivate the membership
        Effect.tap(({ team, member }) => deactivateMember(team.id, (member as any).id)),
        Effect.bind('result', ({ team, userId }) =>
          TeamMembersRepository.asEffect().pipe(
            Effect.andThen((repo) =>
              repo.findMembershipByIds(team.id, userId, { includeInactive: true }),
            ),
          ),
        ),
        Effect.tap(({ result }) =>
          Effect.sync(() => {
            // With includeInactive: true, the row must be visible
            expect(Option.isSome(result)).toBe(true);
            const m = Option.getOrThrow(result);
            expect(m.active).toBe(false);
          }),
        ),
        Effect.provide(TestLayer),
      ),
  );

  it.effect(
    'with { includeInactive: false } returns None for inactive — identical to default',
    () =>
      Effect.Do.pipe(
        Effect.bind('userId', () => createUser('800000000000000004', 'mbr-inactive-3')),
        Effect.bind('team', ({ userId }) =>
          createTeam('800400000000000000' as Discord.Snowflake, userId),
        ),
        Effect.bind('member', ({ team, userId }) => addActiveMember(team.id, userId)),
        Effect.tap(({ team, member }) => deactivateMember(team.id, (member as any).id)),
        Effect.bind('result', ({ team, userId }) =>
          TeamMembersRepository.asEffect().pipe(
            Effect.andThen((repo) =>
              repo.findMembershipByIds(team.id, userId, { includeInactive: false }),
            ),
          ),
        ),
        Effect.tap(({ result }) =>
          Effect.sync(() => {
            expect(Option.isNone(result)).toBe(true);
          }),
        ),
        Effect.provide(TestLayer),
      ),
  );
});

// ---------------------------------------------------------------------------
// findByUser — active-only filter
// ---------------------------------------------------------------------------

describe('TeamMembersRepository — findByUser', () => {
  it.effect('returns only active memberships across multiple teams', () =>
    Effect.Do.pipe(
      Effect.bind('userId', () => createUser('800000000000000010', 'mbr-multi-user')),
      Effect.bind('team1', ({ userId }) =>
        createTeam('800500000000000000' as Discord.Snowflake, userId),
      ),
      Effect.bind('team2', ({ userId }) =>
        createTeam('800500000000000001' as Discord.Snowflake, userId),
      ),
      Effect.bind('member1', ({ team1, userId }) => addActiveMember(team1.id, userId)),
      Effect.bind('member2', ({ team2, userId }) => addActiveMember(team2.id, userId)),
      // Deactivate membership in team2
      Effect.tap(({ team2, member2 }) => deactivateMember(team2.id, (member2 as any).id)),
      Effect.bind('results', ({ userId }) =>
        TeamMembersRepository.asEffect().pipe(Effect.andThen((repo) => repo.findByUser(userId))),
      ),
      Effect.tap(({ results, team1, team2 }) =>
        Effect.sync(() => {
          // Only the active team should appear
          expect(results).toHaveLength(1);
          expect(results[0]?.team_id).toBe(team1.id);
          // team2 membership is inactive — must NOT be present
          const hasTeam2 = results.some((m) => m.team_id === team2.id);
          expect(hasTeam2).toBe(false);
        }),
      ),
      Effect.provide(TestLayer),
    ),
  );

  it.effect('returns [] when user has only deactivated memberships', () =>
    Effect.Do.pipe(
      Effect.bind('userId', () => createUser('800000000000000011', 'mbr-all-inactive')),
      Effect.bind('team', ({ userId }) =>
        createTeam('800600000000000000' as Discord.Snowflake, userId),
      ),
      Effect.bind('member', ({ team, userId }) => addActiveMember(team.id, userId)),
      Effect.tap(({ team, member }) => deactivateMember(team.id, (member as any).id)),
      Effect.bind('results', ({ userId }) =>
        TeamMembersRepository.asEffect().pipe(Effect.andThen((repo) => repo.findByUser(userId))),
      ),
      Effect.tap(({ results }) =>
        Effect.sync(() => {
          expect(results).toHaveLength(0);
        }),
      ),
      Effect.provide(TestLayer),
    ),
  );
});
