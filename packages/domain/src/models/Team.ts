import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { UserId } from '~/models/User.js';

export const TeamId = Schema.String.pipe(Schema.brand('TeamId'));
export type TeamId = typeof TeamId.Type;

export class Team extends Model.Class<Team>('Team')({
  id: Model.Generated(TeamId),
  name: Schema.String,
  created_by: UserId,
  created_at: Model.DateTimeInsertFromDate,
  updated_at: Model.DateTimeUpdateFromDate,
}) {}
