// Unit tests for the pure helper `buildManagedAccessGrantEntries` in
// `applications/server/src/utils/managedAccessEntries.ts`.
//
// Behaviour under test:
//   - All groups resolvable → all entries present, unresolvableGroupIds empty
//   - One group unresolvable → only resolvable group in entries, C in unresolvableGroupIds
//   - Multiple groups all unresolvable → entries empty, unresolvableGroupIds contains all

import { describe, expect, it } from '@effect/vitest';
import type { Discord, GroupModel, TeamChannel, TeamChannelAccess } from '@sideline/domain';
import { Effect } from 'effect';
import { buildManagedAccessGrantEntries } from '../../src/utils/managedAccessEntries.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEAM_CHANNEL_ID = '00000000-0000-0000-0099-000000000001' as TeamChannel.TeamChannelId;
const DISCORD_CHANNEL_ID = '555555555555555555' as Discord.Snowflake;
const GROUP_A = '00000000-0000-0000-0099-000000000010' as GroupModel.GroupId;
const GROUP_B = '00000000-0000-0000-0099-000000000011' as GroupModel.GroupId;
const GROUP_C = '00000000-0000-0000-0099-000000000012' as GroupModel.GroupId;
const ROLE_A = '111111111111111111' as Discord.Snowflake;
const ROLE_B = '222222222222222222' as Discord.Snowflake;

const channel = {
  teamChannelId: TEAM_CHANNEL_ID,
  discordChannelId: DISCORD_CHANNEL_ID,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Typed grant fixture — avoids `as X` casts by using `satisfies` to narrow the literal
// to the union type while keeping the value as a plain string literal.
type GrantInput = ReadonlyArray<{
  readonly groupId: GroupModel.GroupId;
  readonly accessLevel: TeamChannelAccess.AccessLevel;
}>;

describe('buildManagedAccessGrantEntries', () => {
  it.effect('[A, B] both mapped → 2 entries, unresolvableGroupIds empty', () =>
    Effect.sync(() => {
      // Production SQL filters `discord_role_id IS NOT NULL`, so only groups with a
      // resolvable role appear in the returned rows. The mock mirrors this: groups in
      // groupRoleMap get an entry; all others are omitted — GROUP_C has no entry here.
      const roleMap = new Map<GroupModel.GroupId, Discord.Snowflake | null>([
        [GROUP_A, ROLE_A],
        [GROUP_B, ROLE_B],
      ]);

      const grants: GrantInput = [
        { groupId: GROUP_A, accessLevel: 'VIEW' satisfies TeamChannelAccess.AccessLevel },
        { groupId: GROUP_B, accessLevel: 'EDIT' satisfies TeamChannelAccess.AccessLevel },
      ];

      const { entries, unresolvableGroupIds } = buildManagedAccessGrantEntries(
        grants,
        roleMap,
        channel,
      );

      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.discordRoleId)).toContain(ROLE_A);
      expect(entries.map((e) => e.discordRoleId)).toContain(ROLE_B);
      expect(entries.every((e) => e.teamChannelId === TEAM_CHANNEL_ID)).toBe(true);
      expect(entries.every((e) => e.discordChannelId === DISCORD_CHANNEL_ID)).toBe(true);

      expect(unresolvableGroupIds).toHaveLength(0);
    }),
  );

  it.effect('[A, C] with C unmapped → 1 entry (A), unresolvableGroupIds = [C]', () =>
    Effect.sync(() => {
      // Production SQL filters `discord_role_id IS NOT NULL` — unresolvable groups (GROUP_C)
      // are OMITTED from the returned rows entirely. The mock reflects this: only GROUP_A
      // appears in the map; GROUP_C is absent (not present as a key, not set to null).
      // An explicit null entry for GROUP_C would also work and makes intent clearer:
      const roleMap = new Map<GroupModel.GroupId, Discord.Snowflake | null>([
        [GROUP_A, ROLE_A],
        [GROUP_C, null], // explicitly unresolvable — mirrors what a null discord_role_id would produce
      ]);

      const grants: GrantInput = [
        { groupId: GROUP_A, accessLevel: 'VIEW' satisfies TeamChannelAccess.AccessLevel },
        { groupId: GROUP_C, accessLevel: 'VIEW' satisfies TeamChannelAccess.AccessLevel },
      ];

      const { entries, unresolvableGroupIds } = buildManagedAccessGrantEntries(
        grants,
        roleMap,
        channel,
      );

      expect(entries).toHaveLength(1);
      expect(entries[0]?.discordRoleId).toBe(ROLE_A);

      expect(unresolvableGroupIds).toHaveLength(1);
      expect(unresolvableGroupIds[0]).toBe(GROUP_C);
    }),
  );

  it.effect('[C] all unresolvable → 0 entries, unresolvableGroupIds = [C]', () =>
    Effect.sync(() => {
      // GROUP_C explicitly mapped to null — mirrors a row where discord_role_id IS NULL.
      // Production SQL (IS NOT NULL filter) would omit the row entirely; setting null here
      // makes the intent clear and exercises the same null-guard in buildManagedAccessGrantEntries.
      const roleMap = new Map<GroupModel.GroupId, Discord.Snowflake | null>([[GROUP_C, null]]);

      const grants: GrantInput = [
        { groupId: GROUP_C, accessLevel: 'VIEW' satisfies TeamChannelAccess.AccessLevel },
      ];

      const { entries, unresolvableGroupIds } = buildManagedAccessGrantEntries(
        grants,
        roleMap,
        channel,
      );

      expect(entries).toHaveLength(0);
      expect(unresolvableGroupIds).toHaveLength(1);
      expect(unresolvableGroupIds[0]).toBe(GROUP_C);
    }),
  );
});
