import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';

export const TrainingTypeId = Schema.String.pipe(Schema.brand('TrainingTypeId'));
export type TrainingTypeId = typeof TrainingTypeId.Type;

export class TrainingType extends Model.Class<TrainingType>('TrainingType')({
  id: Model.Generated(TrainingTypeId),
  team_id: TeamId,
  name: Schema.String,
  owner_group_id: Schema.OptionFromNullOr(GroupId),
  member_group_id: Schema.OptionFromNullOr(GroupId),
  created_at: Model.DateTimeInsertFromDate,
}) {}
