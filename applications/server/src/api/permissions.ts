import type { Auth, Role as RoleNS, Team } from '@sideline/domain';
import { Role } from '@sideline/domain';
import { Effect, Option } from 'effect';
import type {
  MembershipWithRole,
  TeamMembersRepository,
} from '~/repositories/TeamMembersRepository.js';

const knownPermissions: ReadonlySet<string> = new Set(Role.allPermissions);

export const parsePermissions = (permissionsStr: string): ReadonlyArray<RoleNS.Permission> =>
  permissionsStr === ''
    ? []
    : (permissionsStr
        .split(',')
        .filter((p) => knownPermissions.has(p)) as ReadonlyArray<RoleNS.Permission>);

export const requireMembership = <E>(
  members: TeamMembersRepository,
  teamId: Team.TeamId,
  userId: Auth.UserId,
  forbidden: E,
) =>
  members.findMembershipByIds(teamId, userId).pipe(
    Effect.tapError((e) => Effect.logWarning('Unexpected error in membership check', e)),
    Effect.mapError(() => forbidden),
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(forbidden).pipe(
            Effect.tapError(() =>
              Effect.logWarning(`Denied access for user ${userId} to team ${teamId}`),
            ),
          ),
        onSome: Effect.succeed,
      }),
    ),
  );

export const hasPermission = (
  membership: MembershipWithRole,
  permission: RoleNS.Permission,
): boolean => {
  const perms = parsePermissions(membership.permissions);
  return perms.includes(permission);
};

export const requirePermission = <E>(
  membership: MembershipWithRole,
  permission: RoleNS.Permission,
  forbidden: E,
) => {
  const perms = parsePermissions(membership.permissions);
  return perms.includes(permission)
    ? Effect.void
    : Effect.fail(forbidden).pipe(
        Effect.tapError(() =>
          Effect.logWarning(
            `Denied permission ${permission} for user ${membership.user_id} to team ${membership.team_id}`,
          ),
        ),
      );
};
