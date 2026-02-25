import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { RoleId } from '~/models/Role.js';
import { TeamId } from '~/models/Team.js';
import { UserId } from '~/models/User.js';

export const TeamMemberId = Schema.String.pipe(Schema.brand('TeamMemberId'));
export type TeamMemberId = typeof TeamMemberId.Type;

export class TeamMember extends Model.Class<TeamMember>('TeamMember')({
  id: Model.Generated(TeamMemberId),
  team_id: TeamId,
  user_id: UserId,
  role_id: RoleId,
  active: Schema.Boolean,
  joined_at: Model.DateTimeInsertFromDate,
}) {}
