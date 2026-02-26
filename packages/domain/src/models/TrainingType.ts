import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';

export const TrainingTypeId = Schema.String.pipe(Schema.brand('TrainingTypeId'));
export type TrainingTypeId = typeof TrainingTypeId.Type;

export class TrainingType extends Model.Class<TrainingType>('TrainingType')({
  id: Model.Generated(TrainingTypeId),
  team_id: TeamId,
  name: Schema.String,
  created_at: Model.DateTimeInsertFromDate,
}) {}
