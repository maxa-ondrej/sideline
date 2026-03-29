import { HttpApiBuilder } from '@effect/platform';
import { Auth, TrainingTypeApi } from '@sideline/domain';
import { LogicError } from '@sideline/effect-lib';
import { Array, Effect, Option } from 'effect';
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
            Effect.bind('list', () => trainingTypes.findTrainingTypesByTeamId(teamId)),
            Effect.map(
              ({ list, isAdmin }) =>
                new TrainingTypeApi.TrainingTypeListResponse({
                  canAdmin: isAdmin,
                  trainingTypes: Array.map(
                    list,
                    (t) =>
                      new TrainingTypeApi.TrainingTypeInfo({
                        trainingTypeId: t.id,
                        teamId: t.team_id,
                        name: t.name,
                        ownerGroupName: t.owner_group_name,
                        memberGroupName: t.member_group_name,
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
              trainingTypes.insertTrainingType(
                teamId,
                payload.name,
                payload.ownerGroupId,
                payload.memberGroupId,
                payload.discordChannelId,
              ),
            ),
            Effect.map(
              ({ trainingType }) =>
                new TrainingTypeApi.TrainingTypeInfo({
                  trainingTypeId: trainingType.id,
                  teamId: trainingType.team_id,
                  name: trainingType.name,
                  ownerGroupName: Option.none(),
                  memberGroupName: Option.none(),
                }),
            ),
            Effect.catchTag('TrainingTypeNameAlreadyTakenError', () =>
              Effect.fail(new TrainingTypeApi.TrainingTypeNameAlreadyTaken()),
            ),
            Effect.catchTag(
              'NoSuchElementException',
              LogicError.withMessage(() => 'Failed creating training type — no row returned'),
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
                  ownerGroupId: trainingType.owner_group_id,
                  ownerGroupName: trainingType.owner_group_name,
                  memberGroupId: trainingType.member_group_id,
                  memberGroupName: trainingType.member_group_name,
                  discordChannelId: trainingType.discord_channel_id,
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
            Effect.bind('updated', ({ existing }) =>
              trainingTypes.updateTrainingType(
                trainingTypeId,
                payload.name,
                Option.match(payload.ownerGroupId, {
                  onNone: () => existing.owner_group_id,
                  onSome: (v) => v,
                }),
                Option.match(payload.memberGroupId, {
                  onNone: () => existing.member_group_id,
                  onSome: (v) => v,
                }),
                Option.match(payload.discordChannelId, {
                  onNone: () => existing.discord_channel_id,
                  onSome: (v) => v,
                }),
              ),
            ),
            Effect.map(
              ({ updated }) =>
                new TrainingTypeApi.TrainingTypeInfo({
                  trainingTypeId: updated.id,
                  teamId: updated.team_id,
                  name: updated.name,
                  ownerGroupName: Option.none(),
                  memberGroupName: Option.none(),
                }),
            ),
            Effect.catchTag('TrainingTypeNameAlreadyTakenError', () =>
              Effect.fail(new TrainingTypeApi.TrainingTypeNameAlreadyTaken()),
            ),
            Effect.catchTag(
              'NoSuchElementException',
              LogicError.withMessage(() => 'Failed updating training type — no row returned'),
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
            Effect.tap(() => trainingTypes.deleteTrainingTypeById(trainingTypeId)),
            Effect.asVoid,
          ),
        ),
    ),
  ),
);
