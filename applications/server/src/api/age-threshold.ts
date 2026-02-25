import { HttpApiBuilder } from '@effect/platform';
import { AgeThresholdApi, Auth } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { requireMembership, requirePermission } from '~/api/permissions.js';
import { AgeThresholdRepository } from '~/repositories/AgeThresholdRepository.js';
import { RolesRepository } from '~/repositories/RolesRepository.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { AgeCheckService } from '~/services/AgeCheckService.js';

const forbidden = new AgeThresholdApi.Forbidden();

export const AgeThresholdApiLive = HttpApiBuilder.group(Api, 'ageThreshold', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('thresholds', () => AgeThresholdRepository),
    Effect.bind('roles', () => RolesRepository),
    Effect.bind('ageCheck', () => AgeCheckService),
    Effect.map(({ members, thresholds, roles, ageCheck }) =>
      handlers
        .handle('listAgeThresholds', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'role:manage', forbidden)),
            Effect.bind('rules', () =>
              thresholds.findRulesByTeamId(teamId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(({ rules }) =>
              rules.map(
                (r) =>
                  new AgeThresholdApi.AgeThresholdInfo({
                    ruleId: r.id,
                    teamId: r.team_id,
                    roleId: r.role_id,
                    roleName: r.role_name,
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
            Effect.bind('role', () =>
              roles.findRoleById(payload.roleId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new AgeThresholdApi.RoleNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ role }) =>
              role.team_id !== teamId
                ? Effect.fail(new AgeThresholdApi.RoleNotFound())
                : Effect.void,
            ),
            Effect.bind('rule', () =>
              thresholds
                .insertRule(teamId, payload.roleId, payload.minAge, payload.maxAge)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ rule }) =>
                new AgeThresholdApi.AgeThresholdInfo({
                  ruleId: rule.id,
                  teamId: rule.team_id,
                  roleId: rule.role_id,
                  roleName: rule.role_name,
                  minAge: rule.min_age,
                  maxAge: rule.max_age,
                }),
            ),
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
                Effect.mapError(() => forbidden),
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
              thresholds
                .updateRuleById(ruleId, payload.minAge, payload.maxAge)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ updated }) =>
                new AgeThresholdApi.AgeThresholdInfo({
                  ruleId: updated.id,
                  teamId: updated.team_id,
                  roleId: updated.role_id,
                  roleName: updated.role_name,
                  minAge: updated.min_age,
                  maxAge: updated.max_age,
                }),
            ),
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
                Effect.mapError(() => forbidden),
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
            Effect.tap(() =>
              thresholds.deleteRuleById(ruleId).pipe(Effect.mapError(() => forbidden)),
            ),
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
              const currentYear = new Date().getFullYear();
              return ageCheck.evaluate(teamId, currentYear).pipe(Effect.mapError(() => forbidden));
            }),
            Effect.map(({ changes }) => changes),
          ),
        ),
    ),
  ),
);
