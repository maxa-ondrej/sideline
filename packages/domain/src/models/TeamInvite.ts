import { Model } from '@effect/sql';
import * as Schemas from '@sideline/effect-lib/Schemas';
import { Schema } from 'effect';
import { TeamId } from '~/models/Team.js';
import { UserId } from '~/models/User.js';

export const TeamInviteId = Schema.String.pipe(Schema.brand('TeamInviteId'));
export type TeamInviteId = typeof TeamInviteId.Type;

export class TeamInvite extends Model.Class<TeamInvite>('TeamInvite')({
  id: Model.Generated(TeamInviteId),
  team_id: TeamId,
  code: Schema.String,
  active: Schema.Boolean,
  created_by: UserId,
  created_at: Model.DateTimeInsertFromDate,
  expires_at: Schema.OptionFromNullOr(Schemas.DateTimeFromDate),
}) {}
