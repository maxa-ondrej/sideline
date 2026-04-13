import { Schema } from 'effect';
import { SqlModel as Model } from 'effect/unstable/sql';
import { TeamId } from '~/models/Team.js';

export const GroupId = Schema.String.pipe(Schema.brand('GroupId'));
export type GroupId = typeof GroupId.Type;

export class Group extends Model.Class<Group>('Group')({
  id: Model.Generated(GroupId),
  team_id: TeamId,
  parent_id: Schema.OptionFromNullOr(GroupId),
  name: Schema.String,
  emoji: Schema.OptionFromNullOr(Schema.String),
  color: Schema.OptionFromNullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
