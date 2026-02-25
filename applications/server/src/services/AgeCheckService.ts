import {
  AgeThresholdApi,
  type Role as RoleNS,
  type TeamMember as TeamMemberNS,
  type Team as TeamNS,
  type User as UserNS,
} from '@sideline/domain';
import { Effect } from 'effect';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

export class AgeCheckService extends Effect.Service<AgeCheckService>()('api/AgeCheckService', {
  effect: Effect.Do.pipe(
    Effect.bind('thresholds', () => AgeThresholdRepository),
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('notifications', () => NotificationsRepository),
    Effect.bind('syncEvents', () => RoleSyncEventsRepository),
    Effect.let(
      'evaluateTeam',
      ({ thresholds, members, notifications, syncEvents }) =>
        (teamId: TeamNS.TeamId, currentYear: number) =>
          Effect.Do.pipe(
            Effect.bind('rules', () =>
              thresholds.findRulesByTeamId(teamId).pipe(Effect.mapError(() => 'db' as const)),
            ),
            Effect.bind('teamMembers', () =>
              thresholds
                .getMembersWithBirthYears(teamId)
                .pipe(Effect.mapError(() => 'db' as const)),
            ),
            Effect.bind('changes', ({ rules, teamMembers }) => {
              const changes: Array<{
                memberId: TeamMemberNS.TeamMemberId;
                memberName: string;
                roleId: RoleNS.RoleId;
                roleName: string;
                action: 'assigned' | 'removed';
              }> = [];

              const ops: Array<Effect.Effect<void, 'db'>> = [];

              for (const rule of rules) {
                for (const member of teamMembers) {
                  if (member.birth_year === null) continue;

                  const age = currentYear - member.birth_year;
                  const minOk = rule.min_age === null || age >= rule.min_age;
                  const maxOk = rule.max_age === null || age <= rule.max_age;
                  const shouldHaveRole = minOk && maxOk;

                  const currentRoleIds = member.role_ids.split(',').filter((id) => id.length > 0);
                  const hasRole = currentRoleIds.includes(rule.role_id);
                  const memberId = member.member_id as TeamMemberNS.TeamMemberId;
                  const displayName = member.member_name ?? member.discord_username;

                  if (shouldHaveRole && !hasRole) {
                    ops.push(
                      members
                        .assignRole(memberId, rule.role_id)
                        .pipe(Effect.mapError(() => 'db' as const)),
                    );
                    changes.push({
                      memberId,
                      memberName: displayName,
                      roleId: rule.role_id,
                      roleName: rule.role_name,
                      action: 'assigned',
                    });
                  } else if (!shouldHaveRole && hasRole) {
                    ops.push(
                      members
                        .unassignRole(memberId, rule.role_id)
                        .pipe(Effect.mapError(() => 'db' as const)),
                    );
                    changes.push({
                      memberId,
                      memberName: displayName,
                      roleId: rule.role_id,
                      roleName: rule.role_name,
                      action: 'removed',
                    });
                  }
                }
              }

              return Effect.all(ops).pipe(Effect.map(() => changes));
            }),
            Effect.tap(({ changes, teamMembers }) => {
              if (changes.length === 0) return Effect.void;

              const adminUserIds = teamMembers
                .filter((m) => {
                  const roleIds = m.role_ids.split(',').filter((id) => id.length > 0);
                  return roleIds.length > 0;
                })
                .map((m) => m.user_id as UserNS.UserId);

              const uniqueAdminIds = [...new Set(adminUserIds)];

              const notifs = changes.flatMap((change) =>
                uniqueAdminIds.map((userId) => ({
                  teamId,
                  userId,
                  type: (change.action === 'assigned' ? 'age_role_assigned' : 'age_role_removed') as
                    | 'age_role_assigned'
                    | 'age_role_removed',
                  title:
                    change.action === 'assigned'
                      ? `Role "${change.roleName}" assigned`
                      : `Role "${change.roleName}" removed`,
                  body:
                    change.action === 'assigned'
                      ? `${change.memberName} was automatically assigned the "${change.roleName}" role based on age threshold.`
                      : `${change.memberName} was automatically removed from the "${change.roleName}" role based on age threshold.`,
                })),
              );

              return notifs.length > 0
                ? notifications.insertBulk(notifs).pipe(Effect.mapError(() => 'db' as const))
                : Effect.void;
            }),
            Effect.tap(({ changes, teamMembers }) => {
              if (changes.length === 0) return Effect.void;

              return Effect.all(
                changes.map((change) => {
                  const member = teamMembers.find(
                    (m) => (m.member_id as TeamMemberNS.TeamMemberId) === change.memberId,
                  );
                  return syncEvents
                    .emitIfGuildLinked(
                      teamId,
                      change.action === 'assigned' ? 'role_assigned' : 'role_unassigned',
                      change.roleId,
                      change.roleName,
                      change.memberId,
                      member?.discord_id,
                    )
                    .pipe(
                      Effect.tapError((e) => Effect.logWarning('sync event failed', e)),
                      Effect.catchAll(() => Effect.void),
                    );
                }),
              ).pipe(Effect.asVoid);
            }),
            Effect.map(({ changes }) =>
              changes.map(
                (c) =>
                  new AgeThresholdApi.AgeRoleChange({
                    memberId: c.memberId,
                    memberName: c.memberName,
                    roleId: c.roleId,
                    roleName: c.roleName,
                    action: c.action,
                  }),
              ),
            ),
          ),
    ),
    Effect.map(({ evaluateTeam }) => ({ evaluateTeam })),
  ),
}) {
  evaluate(teamId: TeamNS.TeamId, currentYear: number) {
    return this.evaluateTeam(teamId, currentYear);
  }
}
