import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { GroupId } from '~/models/GroupModel.js';
import { TeamId } from '~/models/Team.js';

export const AgeThresholdRuleId = Schema.String.pipe(Schema.brand('AgeThresholdRuleId'));
export type AgeThresholdRuleId = typeof AgeThresholdRuleId.Type;

export class AgeThresholdRule extends Model.Class<AgeThresholdRule>('AgeThresholdRule')({
  id: Model.Generated(AgeThresholdRuleId),
  team_id: TeamId,
  group_id: GroupId,
  min_age: Schema.OptionFromNullOr(Schema.Number),
  max_age: Schema.OptionFromNullOr(Schema.Number),
  created_at: Model.DateTimeInsertFromDate,
}) {}
