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
            Effect.bind('list', () =>
              trainingTypes
                .findTrainingTypesByTeamId(teamId)
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
                        groupName: t.group_name,
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
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'training-type:create', forbidden),
            ),
            Effect.bind('trainingType', () =>
              trainingTypes
                .insertTrainingType(teamId, payload.name, payload.groupId)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ trainingType }) =>
                new TrainingTypeApi.TrainingTypeInfo({
                  trainingTypeId: trainingType.id,
                  teamId: trainingType.team_id,
                  name: trainingType.name,
                  groupName: null,
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
              trainingTypes.findTrainingTypeByIdWithGroup(trainingTypeId).pipe(
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
            Effect.map(
              ({ trainingType, isAdmin }) =>
                new TrainingTypeApi.TrainingTypeDetail({
                  trainingTypeId: trainingType.id,
                  teamId: trainingType.team_id,
                  name: trainingType.name,
                  groupId: trainingType.group_id,
                  groupName: trainingType.group_name,
                  canAdmin: isAdmin,
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
            Effect.bind('updated', () =>
              trainingTypes
                .updateTrainingType(trainingTypeId, payload.name)
                .pipe(Effect.mapError(() => forbidden)),
            ),
            Effect.map(
              ({ updated }) =>
                new TrainingTypeApi.TrainingTypeInfo({
                  trainingTypeId: updated.id,
                  teamId: updated.team_id,
                  name: updated.name,
                  groupName: null,
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
            Effect.tap(({ membership }) =>
              requirePermission(membership, 'training-type:delete', forbidden),
            ),
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
        ),
    ),
  ),
);
