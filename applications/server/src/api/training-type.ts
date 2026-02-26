import { HttpApiBuilder } from '@effect/platform';
import { Auth, TrainingTypeApi } from '@sideline/domain';
import { Effect, Option } from 'effect';
import { Api } from '~/api/api.js';
import { hasPermission, requireMembership, requirePermission } from '~/api/permissions.js';
import { TeamMembersRepository } from '~/repositories/TeamMembersRepository.js';
import { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';

const forbidden = new TrainingTypeApi.Forbidden();

export const TrainingTypeApiLive = HttpApiBuilder.group(Api, 'trainingType', (handlers) =>
  Effect.Do.pipe(
    Effect.bind('members', () => TeamMembersRepository),
    Effect.bind('trainingTypes', () => TrainingTypesRepository),
    Effect.map(({ members, trainingTypes }) =>
      handlers
        .handle('listTrainingTypes', ({ path: { teamId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.let('isAdmin', ({ membership }) => hasPermission(membership, 'team:manage')),
            Effect.bind('list', ({ isAdmin, membership }) =>
              isAdmin
                ? trainingTypes
                    .findTrainingTypesByTeamId(teamId)
                    .pipe(Effect.mapError(() => forbidden))
                : trainingTypes
                    .findTrainingTypesByCoach(teamId, membership.id)
                    .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ list, isAdmin }) =>
                new TrainingTypeApi.TrainingTypeListResponse({
                  canAdmin: isAdmin,
                  trainingTypes: list.map(
                    (t) =>
                      new TrainingTypeApi.TrainingTypeInfo({
                        trainingTypeId: t.id,
                        teamId: t.team_id,
                        name: t.name,
                        coachCount: t.coach_count,
                      }),
                  ),
                }),
            ),
          ),
        )
        .handle('createTrainingType', ({ path: { teamId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('trainingType', () =>
              trainingTypes
                .insertTrainingType(teamId, payload.name)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ trainingType }) =>
                new TrainingTypeApi.TrainingTypeInfo({
                  trainingTypeId: trainingType.id,
                  teamId: trainingType.team_id,
                  name: trainingType.name,
                  coachCount: 0,
                }),
            ),
          ),
        )
        .handle('getTrainingType', ({ path: { teamId, trainingTypeId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.let('isAdmin', ({ membership }) => hasPermission(membership, 'team:manage')),
            Effect.bind('trainingType', () =>
              trainingTypes.findTrainingTypeById(trainingTypeId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new TrainingTypeApi.TrainingTypeNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ trainingType }) =>
              trainingType.team_id !== teamId
                ? Effect.fail(new TrainingTypeApi.TrainingTypeNotFound())
                : Effect.void,
            ),
            Effect.tap(({ isAdmin, membership }) =>
              isAdmin
                ? Effect.void
                : trainingTypes.isCoachForTrainingType(trainingTypeId, membership.id).pipe(
                    Effect.mapError(() => forbidden),
                    Effect.flatMap((isCoach) => (isCoach ? Effect.void : Effect.fail(forbidden))),
                  ),
            ),
            Effect.bind('coaches', () =>
              trainingTypes
                .findCoachesByTrainingTypeId(trainingTypeId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ trainingType, coaches, isAdmin }) =>
                new TrainingTypeApi.TrainingTypeDetail({
                  trainingTypeId: trainingType.id,
                  teamId: trainingType.team_id,
                  name: trainingType.name,
                  canAdmin: isAdmin,
                  coaches: coaches.map((c) => ({
                    memberId: c.member_id,
                    name: c.name,
                    discordUsername: c.discord_username,
                  })),
                }),
            ),
          ),
        )
        .handle('updateTrainingType', ({ path: { teamId, trainingTypeId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.let('isAdmin', ({ membership }) => hasPermission(membership, 'team:manage')),
            Effect.bind('existing', () =>
              trainingTypes.findTrainingTypeById(trainingTypeId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new TrainingTypeApi.TrainingTypeNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId
                ? Effect.fail(new TrainingTypeApi.TrainingTypeNotFound())
                : Effect.void,
            ),
            Effect.tap(({ isAdmin, membership }) =>
              isAdmin
                ? Effect.void
                : trainingTypes.isCoachForTrainingType(trainingTypeId, membership.id).pipe(
                    Effect.mapError(() => forbidden),
                    Effect.flatMap((isCoach) => (isCoach ? Effect.void : Effect.fail(forbidden))),
                  ),
            ),
            Effect.bind('updated', () =>
              trainingTypes
                .updateTrainingType(trainingTypeId, payload.name)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.bind('coachCount', () =>
              trainingTypes.getCoachCount(trainingTypeId).pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ updated, coachCount }) =>
                new TrainingTypeApi.TrainingTypeInfo({
                  trainingTypeId: updated.id,
                  teamId: updated.team_id,
                  name: updated.name,
                  coachCount,
                }),
            ),
          ),
        )
        .handle('deleteTrainingType', ({ path: { teamId, trainingTypeId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('existing', () =>
              trainingTypes.findTrainingTypeById(trainingTypeId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new TrainingTypeApi.TrainingTypeNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(({ existing }) =>
              existing.team_id !== teamId
                ? Effect.fail(new TrainingTypeApi.TrainingTypeNotFound())
                : Effect.void,
            ),
            Effect.tap(() =>
              trainingTypes
                .deleteTrainingTypeById(trainingTypeId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.asVoid,
          ),
        )
        .handle('addTrainingTypeCoach', ({ path: { teamId, trainingTypeId }, payload }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('_trainingType', () =>
              trainingTypes.findTrainingTypeById(trainingTypeId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new TrainingTypeApi.TrainingTypeNotFound()),
                    onSome: (tt) =>
                      tt.team_id !== teamId
                        ? Effect.fail(new TrainingTypeApi.TrainingTypeNotFound())
                        : Effect.succeed(tt),
                  }),
                ),
              ),
            ),
            Effect.bind('_member', () =>
              members.findRosterMemberByIds(teamId, payload.memberId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new TrainingTypeApi.MemberNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              trainingTypes
                .addCoachById(trainingTypeId, payload.memberId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.asVoid,
          ),
        )
        .handle('removeTrainingTypeCoach', ({ path: { teamId, trainingTypeId, memberId } }) =>
          Effect.Do.pipe(
            Effect.bind('currentUser', () => Auth.CurrentUserContext),
            Effect.bind('membership', ({ currentUser }) =>
              requireMembership(members, teamId, currentUser.id, forbidden),
            ),
            Effect.tap(({ membership }) => requirePermission(membership, 'team:manage', forbidden)),
            Effect.bind('_trainingType', () =>
              trainingTypes.findTrainingTypeById(trainingTypeId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new TrainingTypeApi.TrainingTypeNotFound()),
                    onSome: (tt) =>
                      tt.team_id !== teamId
                        ? Effect.fail(new TrainingTypeApi.TrainingTypeNotFound())
                        : Effect.succeed(tt),
                  }),
                ),
              ),
            ),
            Effect.bind('_member', () =>
              members.findRosterMemberByIds(teamId, memberId).pipe(
                Effect.mapError(() => forbidden),
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.fail(new TrainingTypeApi.MemberNotFound()),
                    onSome: Effect.succeed,
                  }),
                ),
              ),
            ),
            Effect.tap(() =>
              trainingTypes
                .removeCoachById(trainingTypeId, memberId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
