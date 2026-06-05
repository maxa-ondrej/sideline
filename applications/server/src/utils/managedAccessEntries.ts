import type { Discord, GroupModel, TeamChannel, TeamChannelAccess } from '@sideline/domain';

/**
 * Shared, pure builder for managed-channel access-grant sync entries.
 *
 * Both `api/channel.ts` (setAccess) and `rpc/channel` (UpsertManagedChannel reconcile) need to
 * turn a list of `(groupId, accessLevel)` pairs into `emitManagedAccessGrantedBatch` entries,
 * resolving each group's Discord role id from `roleMap` and skipping groups whose role id could
 * not be resolved. This keeps that mapping in one place instead of duplicating the
 * `flatMap`/`filter` logic at both call sites.
 *
 * @returns `entries` — the resolvable grants ready to emit; `unresolvableGroupIds` — groups with
 *   no `discord_role_id` resolved, surfaced by the caller as warning logs before emitting.
 */
export const buildManagedAccessGrantEntries = (
  grants: ReadonlyArray<{
    readonly groupId: GroupModel.GroupId;
    readonly accessLevel: TeamChannelAccess.AccessLevel;
  }>,
  roleMap: ReadonlyMap<GroupModel.GroupId, Discord.Snowflake | null>,
  channel: {
    readonly teamChannelId: TeamChannel.TeamChannelId;
    readonly discordChannelId: Discord.Snowflake;
  },
): {
  readonly entries: ReadonlyArray<{
    readonly teamChannelId: TeamChannel.TeamChannelId;
    readonly discordChannelId: Discord.Snowflake;
    readonly discordRoleId: Discord.Snowflake;
    readonly accessLevel: TeamChannelAccess.AccessLevel;
  }>;
  readonly unresolvableGroupIds: ReadonlyArray<GroupModel.GroupId>;
} => {
  const unresolvableGroupIds = grants
    .filter(({ groupId }) => (roleMap.get(groupId) ?? null) === null)
    .map(({ groupId }) => groupId);
  const entries = grants.flatMap(({ groupId, accessLevel }) => {
    const discordRoleId = roleMap.get(groupId);
    if (discordRoleId == null) return [];
    return [
      {
        teamChannelId: channel.teamChannelId,
        discordChannelId: channel.discordChannelId,
        discordRoleId,
        accessLevel,
      },
    ];
  });
  return { entries, unresolvableGroupIds };
};
