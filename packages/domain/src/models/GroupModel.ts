import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';

export const GroupId = Schema.String.pipe(Schema.brand('GroupId'));
export type GroupId = typeof GroupId.Type;

export class Group extends Model.Class<Group>('Group')({
  id: Model.Generated(GroupId),
  team_id: TeamId,
  parent_id: Schema.NullOr(GroupId),
  name: Schema.String,
  emoji: Schema.NullOr(Schema.String),
  created_at: Model.DateTimeInsertFromDate,
}) {}
