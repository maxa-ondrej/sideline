import type { Auth, Role, Team } from '@sideline/domain';
import { Array, Effect, Option, pipe, type ServiceMap } from 'effect';
import type {
  MembershipWithRole,
  TeamMembersRepository,
} from '~/repositories/TeamMembersRepository.js';

export const requireMembership = <E>(
  members: ServiceMap.Service.Shape<typeof TeamMembersRepository>,
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
): boolean => pipe(membership.permissions, Array.contains(permission));

export const requirePermission = <E>(
  membership: MembershipWithRole,
  permission: Role.Permission,
  forbidden: E,
) =>
  pipe(membership.permissions, Array.contains(permission))
    ? Effect.void
    : Effect.fail(forbidden).pipe(
        Effect.tapError(() =>
          Effect.logWarning(
            `Denied permission ${permission} for user ${membership.user_id} to team ${membership.team_id}`,
          ),
        ),
      );
