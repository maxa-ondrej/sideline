import { Schema } from 'effect';
import { RoleId } from '~/models/Role.js';
import { TeamMemberId } from '~/models/TeamMember.js';

export class MemberRole extends Schema.Class<MemberRole>('MemberRole')({
  team_member_id: TeamMemberId,
  role_id: RoleId,
}) {}
