import { HttpApiBuilder } from '@effect/platform';
import { AgeThresholdApi, Auth } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { GroupsRepository } from '~/repositories/GroupsRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';

const forbidden = new AgeThresholdApi.Forbidden();

export const AgeThresholdApiLive = HttpApiBuilder.group(Api, 'ageThreshold', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('thresholds', () => AgeThresholdRepository),
    Effect.bind('groups', () => GroupsRepository),
    Effect.bind('ageCheck', () => AgeCheckService),
    Effect.map(({ members, thresholds, groups, ageCheck }) =>
      handlers
        .handle('listAgeThresholds', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('rules', () => thresholds.findRulesByTeamId(teamId)),
            Effect.map(({ rules }) =>
              rules.map(
                (r) =>
                  new AgeThresholdApi.AgeThresholdInfo({
                    ruleId: r.id,
                    teamId: r.team_id,
                    groupId: r.group_id,
                    groupName: r.group_name,
                    minAge: r.min_age,
                    maxAge: r.max_age,
                  }),
              ),
            ),
          ),
        )
        .handle('createAgeThreshold', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('group', () =>
              groups.findGroupById(payload.groupId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new AgeThresholdApi.GroupNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ group }) =>
              group.team_id !== teamId
                ? Effect.fail(new AgeThresholdApi.GroupNotFound())
                : Effect.void,
            ),
            Effect.bind('rule', () =>
              thresholds.insertRule(teamId, payload.groupId, payload.minAge, payload.maxAge),
            ),
            Effect.map(
              ({ rule }) =>
                new AgeThresholdApi.AgeThresholdInfo({
                  ruleId: rule.id,
                  teamId: rule.team_id,
                  groupId: rule.group_id,
                  groupName: rule.group_name,
                  minAge: rule.min_age,
                  maxAge: rule.max_age,
                }),
            ),
            Effect.catchTag('AgeThresholdAlreadyExistsError', () =>
              Effect.fail(new AgeThresholdApi.AgeThresholdAlreadyExists()),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('updateAgeThreshold', ({ path: { teamId, ruleId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('existing', () =>
              thresholds.findRuleById(ruleId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new AgeThresholdApi.RuleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId
                ? Effect.fail(new AgeThresholdApi.RuleNotFound())
                : Effect.void,
            ),
            Effect.bind('updated', () =>
              thresholds.updateRuleById(ruleId, payload.minAge, payload.maxAge),
            ),
            Effect.map(
              ({ updated }) =>
                new AgeThresholdApi.AgeThresholdInfo({
                  ruleId: updated.id,
                  teamId: updated.team_id,
                  groupId: updated.group_id,
                  groupName: updated.group_name,
                  minAge: updated.min_age,
                  maxAge: updated.max_age,
                }),
            ),
            Effect.catchTag('NoSuchElementException', Effect.die),
          ),
        )
        .handle('deleteAgeThreshold', ({ path: { teamId, ruleId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('existing', () =>
              thresholds.findRuleById(ruleId).pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new AgeThresholdApi.RuleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId
                ? Effect.fail(new AgeThresholdApi.RuleNotFound())
                : Effect.void,
            ),
            Effect.tap(() => thresholds.deleteRuleById(ruleId)),
            Effect.asVoid,
          ),
        )
        .handle('evaluateAgeThresholds', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('changes', () => {
              const today = new Date();
              return ageCheck.evaluate(teamId, today);
            }),
            Effect.map(({ changes }) => changes),
          ),
        ),
    ),
  ),
);
