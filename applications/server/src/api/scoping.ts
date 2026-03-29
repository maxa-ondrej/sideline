import type { GroupModel, TeamMember, TrainingType } from '@sideline/domain';
import { Array, Effect, Option, pipe } from 'effect';
import type { EventsRepository } from '~/repositories/EventsRepository.js';
import type { GroupsRepository } from '~/repositories/GroupsRepository.js';
import type { TrainingTypesRepository } from '~/repositories/TrainingTypesRepository.js';

export const checkCoachScoping = <E>(
  events: EventsRepository,
  memberId: TeamMember.TeamMemberId,
  trainingTypeId: Option.Option<TrainingType.TrainingTypeId>,
  isAdmin: boolean,
  forbidden: E,
) => {
  if (isAdmin) return Effect.void;
  if (Option.isNone(trainingTypeId)) return Effect.void;
  return events.getScopedTrainingTypeIds(memberId).pipe(
    Effect.flatMap((scopedIds) => {
      const allowed = pipe(
        scopedIds,
        Array.map((s) => s.training_type_id),
      );
      if (Array.isEmptyArray(allowed)) return Effect.void;
      return pipe(allowed, Array.contains(trainingTypeId.value))
        ? Effect.void
        : Effect.fail(forbidden);
    }),
  );
};

export const checkGroupAccess = (
  groups: GroupsRepository,
  memberId: TeamMember.TeamMemberId,
  groupId: Option.Option<GroupModel.GroupId>,
): Effect.Effect<boolean, never, never> => {
  if (Option.isNone(groupId)) return Effect.succeed(true);
  return groups
    .getDescendantMemberIds(groupId.value)
    .pipe(Effect.map((memberIds) => Array.contains(memberIds, memberId)));
};

export const checkTrainingTypeOwnerGroup = <E>(
  trainingTypes: TrainingTypesRepository,
  groups: GroupsRepository,
  memberId: TeamMember.TeamMemberId,
  trainingTypeId: Option.Option<TrainingType.TrainingTypeId>,
  isAdmin: boolean,
  forbidden: E,
) => {
  if (isAdmin) return Effect.void;
  if (Option.isNone(trainingTypeId)) return Effect.void;
  return trainingTypes.findTrainingTypeById(trainingTypeId.value).pipe(
    Effect.flatMap((found) => {
      if (Option.isNone(found)) return Effect.void;
      const tt = found.value;
      if (Option.isNone(tt.owner_group_id)) return Effect.void;
      const ownerGroupId = tt.owner_group_id.value;
      return groups
        .getDescendantMemberIds(ownerGroupId)
        .pipe(
          Effect.flatMap((memberIds) =>
            Array.contains(memberIds, memberId) ? Effect.void : Effect.fail(forbidden),
          ),
        );
    }),
  );
};
