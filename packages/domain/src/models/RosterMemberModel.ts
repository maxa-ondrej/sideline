import { Model } from '@effect/sql';
import { Schema } from 'effect';
import { RosterId } from '~/models/RosterModel.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export const RosterMemberId = Schema.String.pipe(Schema.brand('RosterMemberId'));
export type RosterMemberId = typeof RosterMemberId.Type;

export class RosterMember extends Model.Class<RosterMember>('RosterMember')({
  id: Model.Generated(RosterMemberId),
  roster_id: RosterId,
  team_member_id: TeamMemberId,
  created_at: Model.DateTimeInsertFromDate,
}) {}
