import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';

export const SubgroupId = Schema.String.pipe(Schema.brand('SubgroupId'));
export type SubgroupId = typeof SubgroupId.Type;

export class Subgroup extends Model.Class<Subgroup>('Subgroup')({
  id: Model.Generated(SubgroupId),
  team_id: TeamId,
  name: Schema.String,
  created_at: Model.DateTimeInsertFromDate,
}) {}
