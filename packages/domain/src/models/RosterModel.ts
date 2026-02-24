import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';

export const RosterId = Schema.String.pipe(Schema.brand('RosterId'));
export type RosterId = typeof RosterId.Type;

export class Roster extends Model.Class<Roster>('Roster')({
  id: Model.Generated(RosterId),
  team_id: TeamId,
  name: Schema.String,
  active: Schema.Boolean,
  created_at: Model.DateTimeInsertFromDate,
}) {}
