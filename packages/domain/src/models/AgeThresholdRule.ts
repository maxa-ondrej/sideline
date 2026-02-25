import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';

export const AgeThresholdRuleId = Schema.String.pipe(Schema.brand('AgeThresholdRuleId'));
export type AgeThresholdRuleId = typeof AgeThresholdRuleId.Type;

export class AgeThresholdRule extends Model.Class<AgeThresholdRule>('AgeThresholdRule')({
  id: Model.Generated(AgeThresholdRuleId),
  team_id: TeamId,
  role_id: RoleId,
  min_age: Schema.NullOr(Schema.Number),
  max_age: Schema.NullOr(Schema.Number),
  created_at: Model.DateTimeInsertFromDate,
}) {}
