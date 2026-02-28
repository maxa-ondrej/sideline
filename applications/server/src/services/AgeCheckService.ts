import { AgeThresholdApi, type Role, type Team, type TeamMember } from '@sideline/domain';
import { Array, Data, Effect, Option, pipe } from 'effect';
import {
  AgeThresholdRepository,
  type AgeThresholdWithRoleName,
  type MemberWithBirthYear,
} from '~/repositories/AgeThresholdRepository.js';
import { NotificationsRepository } from '~/repositories/NotificationsRepository.js';
import { RoleSyncEventsRepository } from '~/repositories/RoleSyncEventsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';

interface Dependencies {
  thresholds: AgeThresholdRepository;
  members: TeamMembersRepository;
  notifications: NotificationsRepository;
  syncEvents: RoleSyncEventsRepository;
}

interface Change {
  memberId: TeamMember.TeamMemberId;
  memberName: string;
  roleId: Role.RoleId;
  roleName: string;
  action: 'assigned' | 'removed';
}

const makeChange = (change: Change) => change;

const detectChanges = (
  currentYear: number,
  rules: readonly AgeThresholdWithRoleName[],
  teamMembers: readonly MemberWithBirthYear[],
) =>
  pipe(
    teamMembers,
    Array.flatMap((member) =>
      Array.map(rules, (rule) => ({
        rule,
        member,
      })),
    ),
    Array.let('age', ({ member }) => currentYear - member.birth_year),
    Array.let('minOk', ({ age, rule }) =>
      rule.min_age.pipe(
        Option.filter((minAge) => age < minAge),
        Option.isNone,
      ),
    ),
    Array.let('maxOk', ({ age, rule }) =>
      rule.max_age.pipe(
        Option.filter((maxAge) => age > maxAge),
        Option.isNone,
      ),
    ),
    Array.let('shouldHaveRole', ({ minOk, maxOk }) => minOk && maxOk),
    Array.let('hasRole', ({ member, rule }) => Array.contains(member.role_ids, rule.role_id)),
    Array.filter(({ shouldHaveRole, hasRole }) => shouldHaveRole !== hasRole),
    Array.let('displayName', ({ member }) =>
      Option.getOrElse(member.member_name, () => member.discord_username),
    ),
    Array.map(({ shouldHaveRole, member, displayName, rule }) =>
      shouldHaveRole
        ? makeChange({
            memberId: member.member_id,
            memberName: displayName,
            roleId: rule.role_id,
            roleName: rule.role_name,
            action: 'assigned',
          })
        : makeChange({
            memberId: member.member_id,
            memberName: displayName,
            roleId: rule.role_id,
            roleName: rule.role_name,
            action: 'removed',
          }),
    ),
  );

const commitChange = (members: TeamMembersRepository) => (change: Change) =>
  Effect.succeed(change).pipe(
    Effect.tap(
      Effect.if(change.action === 'assigned', {
        onTrue: () => members.assignRole(change.memberId, change.roleId),
        onFalse: () => members.unassignRole(change.memberId, change.roleId),
      }),
    ),
  );

const commitChanges = (members: TeamMembersRepository, changes: readonly Change[]) =>
  pipe(
    changes,
    Array.map(commitChange(members)),
    Array.map(
      Effect.tap((change) =>
        Effect.logInfo(
          `${change.memberId} was automatically ${change.action} the "${change.roleId}" role based on age threshold.`,
        ),
      ),
    ),
    Array.map(Effect.tapError(Effect.logError)),
    Effect.allSuccesses,
    Effect.tap((commits) =>
      Effect.logInfo(`Successfully made ${commits.length} changes to Age based roles!`),
    ),
  );

class NoChanges extends Data.TaggedError('NoChanges')<{
  readonly count: 0;
}> {}

const notifyAdmins = (
  notifications: NotificationsRepository,
  teamId: Team.TeamId,
  changes: readonly Change[],
  teamMembers: readonly MemberWithBirthYear[],
) =>
  Effect.succeed(teamMembers.filter(({ is_admin }) => is_admin).map((m) => m.user_id)).pipe(
    Effect.map(Array.dedupe),
    Effect.map(
      Array.flatMap((userId) =>
        Array.map(changes, (change) =>
          change.action === 'assigned'
            ? {
                teamId,
                userId,
                type: 'age_role_assigned' as const,
                title: `Role "${change.roleName}" assigned`,
                body: `${change.memberName} was automatically assigned the "${change.roleName}" role based on age threshold.`,
              }
            : {
                teamId,
                userId,
                type: 'age_role_removed' as const,
                title: `Role "${change.roleName}" removed`,
                body: `${change.memberName} was automatically removed from the "${change.roleName}" role based on age threshold.`,
              },
        ),
      ),
    ),
    Effect.tap((notifications) =>
      Array.isEmptyArray(notifications) ? Effect.fail(new NoChanges({ count: 0 })) : Effect.void,
    ),
    Effect.flatMap(notifications.insertBulk),
    Effect.tapErrorTag('NoChanges', () => Effect.void),
    Effect.orDie,
  );

const evaluateTeam =
  ({ thresholds, members, notifications, syncEvents }: Dependencies) =>
  (teamId: Team.TeamId, currentYear: number) =>
    Effect.Do.pipe(
      Effect.bind('rules', () => thresholds.findRulesByTeamId(teamId).pipe(Effect.orDie)),
      Effect.bind('teamMembers', () =>
        thresholds.getMembersWithBirthYears(teamId).pipe(Effect.orDie),
      ),
      Effect.let('changes', ({ rules, teamMembers }) =>
        detectChanges(currentYear, rules, teamMembers),
      ),
      Effect.tap(({ changes }) =>
        Array.isEmptyArray(changes) ? Effect.fail(new NoChanges({ count: 0 })) : Effect.void,
      ),
      Effect.tap(({ changes }) =>
        Effect.logInfo(`Detected ${changes.length} changes to be made with Age based roles!`),
      ),
      Effect.bind('commited', ({ changes }) => commitChanges(members, changes)),
      Effect.bind('adminIds', ({ changes }) => commitChanges(members, changes)),
      Effect.tap(({ changes, teamMembers }) =>
        notifyAdmins(notifications, teamId, changes, teamMembers),
      ),
      Effect.tap(({ changes, teamMembers }) =>
        Effect.allSuccesses(
          changes.map((change) =>
            pipe(
              teamMembers,
              Array.findFirst((m) => m.member_id === change.memberId),
              Option.map((m) => m.discord_id),
              Effect.flatMap((memberId) =>
                change.action === 'assigned'
                  ? syncEvents.emitRoleAssigned(
                      teamId,
                      change.roleId,
                      change.roleName,
                      change.memberId,
                      memberId,
                    )
                  : syncEvents.emitRoleUnassigned(
                      teamId,
                      change.roleId,
                      change.roleName,
                      change.memberId,
                      memberId,
                    ),
              ),
              Effect.catchAll((e) => Effect.logError('sync event failed', e)),
            ),
          ),
        ).pipe(Effect.asVoid),
      ),
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
      Effect.catchTag('NoChanges', () => Effect.succeed(Array.empty())),
    );

export class AgeCheckService extends Effect.Service<AgeCheckService>()('api/AgeCheckService', {
  effect: Effect.Do.pipe(
    Effect.bind('thresholds', () => AgeThresholdRepository),
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('notifications', () => NotificationsRepository),
    Effect.bind('syncEvents', () => RoleSyncEventsRepository),
    Effect.let('evaluateTeam', evaluateTeam),
    Effect.map(({ evaluateTeam }) => ({ evaluateTeam })),
  ),
}) {
  evaluate(teamId: Team.TeamId, currentYear: number) {
    return this.evaluateTeam(teamId, currentYear);
  }
}
