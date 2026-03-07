import type { Auth, Role, Team } from '@sideline/domain';
import { Effect, Option } from 'effect';
import type {
  MembershipWithRole,
  TeamMembersRepository,
} from '~/repositories/TeamMembersRepository.js';

export const requireMembership = <E>(
  members: TeamMembersRepository,
  teamId: Team.TeamId,
  userId: Auth.UserId,
  forbidden: E,
) =>
  members.findMembershipByIds(teamId, userId).pipe(
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
  permission: Role.Permission,
): boolean => membership.permissions.includes(permission);

export const requirePermission = <E>(
  membership: MembershipWithRole,
  permission: Role.Permission,
  forbidden: E,
) =>
  membership.permissions.includes(permission)
    ? Effect.void
    : Effect.fail(forbidden).pipe(
        Effect.tapError(() =>
          Effect.logWarning(
            `Denied permission ${permission} for user ${membership.user_id} to team ${membership.team_id}`,
          ),
        ),
      );
